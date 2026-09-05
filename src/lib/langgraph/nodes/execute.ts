import { getServiceClient } from "@/lib/db/service-client";
import { createPaymentLinkForCase } from "@/lib/razorpay/create-payment-link";
import { sendRecoveryEmail } from "@/lib/resend/send-recovery-email";
import { simulateVoiceCall } from "@/lib/voice/simulate-call";
import { buildCollectionsScript, type ScriptLanguage } from "@/lib/voice/collections-script";
import { elevenLabsConfigured, synthesizeSpeech, uploadCallAudio } from "@/lib/voice/elevenlabs";
import { recordDecisionMemory } from "@/lib/memory/decision-memory";
import { appendAudit } from "../audit";
import { AUDIT_EVENT } from "@/lib/audit/event-types";
import type { CaseGraphState, CaseGraphUpdate } from "../state";
import type { Case, CaseStatus, ExecutionProvider, ExecutionStatus } from "@/types/domain";

/**
 * Real dispatch for the unified Recovery Action set:
 *  - payment_link / reminder: real Razorpay Test Mode Payment Link + real
 *    Resend email. Verification for these is asynchronous (webhook or the
 *    demo simulate-payment trigger) — this node does NOT guess an outcome.
 *  - retry: simulated. There's no real payment method to retry against in a
 *    synthetic dataset, so this stays a clearly-labeled placeholder.
 *  - voice: the CALL OUTCOME is simulated (no telephony provider wired up),
 *    but when ELEVENLABS_API_KEY is configured, the actual audio the agent
 *    would speak is REALLY synthesized via ElevenLabs (multilingual model)
 *    and uploaded to Supabase Storage — a genuine artifact, not a
 *    fabricated one. Script language is VOICE_LANGUAGE ("english" | "hindi"
 *    | "hinglish", default "english"). Falls back to pure simulation
 *    (audio_url stays null) if the key is absent or synthesis fails.
 *  - stop / no_action: no external call — recorded as a real execution row
 *    (provider "none") so the executions ledger is the single source of
 *    truth for every decision made, including deliberate non-engagement.
 *    Both are terminal, so decision memory is recorded here.
 * `wait_and_retry` never reaches this node — the graph routes it to `defer`.
 */
export async function executeNode(state: CaseGraphState): Promise<CaseGraphUpdate> {
  if (!state.finalAction) throw new Error("executeNode: finalAction missing from state");
  if (!state.caseRecord) throw new Error("executeNode: caseRecord missing from state");
  const c = state.caseRecord;
  const supabase = getServiceClient();

  const idempotencyKey = `${state.caseId}:${state.finalAction}:${Date.now()}`;

  let provider: ExecutionProvider = "simulated";
  let externalRef: string | null = null;
  let status: ExecutionStatus = "success";
  let requestPayload: Record<string, unknown> = { action: state.finalAction };
  let responsePayload: Record<string, unknown> | null = null;

  if (state.finalAction === "payment_link" || state.finalAction === "reminder") {
    try {
      const link = await createPaymentLinkForCase(c);
      const email = await sendRecoveryEmail({
        toIntended: c.customer_email,
        customerName: c.customer_name,
        amount: c.amount,
        actionType: state.finalAction,
        paymentLinkUrl: link.short_url,
      });
      provider = "razorpay";
      externalRef = link.id;
      requestPayload = { action: state.finalAction, payment_link_id: link.id, short_url: link.short_url };
      responsePayload = { razorpay_status: link.status, resend_email_id: email.id, resend_delivered_to: email.to };
    } catch (err) {
      status = "failed";
      responsePayload = { error: String(err) };
    }
  } else if (state.finalAction === "stop" || state.finalAction === "no_action") {
    provider = "none";
    responsePayload = { note: "Terminal decision — no external call made." };
  }
  // retry / voice: leave provider="simulated", status="success"; voice gets
  // its richer record inserted below once we have the execution's id.

  const { data: execution, error } = await supabase
    .from("executions")
    .insert({
      case_id: state.caseId,
      action_type: state.finalAction,
      provider,
      external_ref: externalRef,
      status,
      idempotency_key: idempotencyKey,
      request_payload: requestPayload,
      response_payload: responsePayload,
    })
    .select()
    .single();
  if (error || !execution) throw new Error(`executeNode: failed to persist execution: ${error?.message}`);

  if (state.finalAction === "voice") {
    await recordVoiceInteraction(c, execution.id, state.selectedImpact?.recovery_probability ?? 0.3);
  }

  if (status === "failed") {
    await supabase.from("cases").update({ status: "failed" }).eq("id", state.caseId);
  } else if (state.finalAction === "stop" || state.finalAction === "no_action") {
    const terminalStatus: CaseStatus = state.finalAction === "stop" ? "stopped" : "closed";
    await supabase.from("cases").update({ status: terminalStatus }).eq("id", state.caseId);
    await recordDecisionMemory({
      customerId: c.customer_id,
      caseId: state.caseId,
      riskType: c.risk_type,
      finalAction: state.finalAction,
      verified: false,
      amountRecovered: 0,
      amount: c.amount,
    });
  }

  await appendAudit(state.caseId, AUDIT_EVENT.ACTION_EXECUTED, "system", {
    action_type: state.finalAction,
    provider,
    external_ref: externalRef,
    status,
  });

  return { executionResult: execution };
}

const VALID_LANGUAGES: readonly ScriptLanguage[] = ["english", "hindi", "hinglish"];

/** Reads VOICE_LANGUAGE ("english" | "hindi" | "hinglish"), defaulting to english. */
function resolveVoiceLanguage(): ScriptLanguage {
  const raw = process.env.VOICE_LANGUAGE?.toLowerCase();
  return (VALID_LANGUAGES as readonly string[]).includes(raw ?? "") ? (raw as ScriptLanguage) : "english";
}

async function recordVoiceInteraction(
  c: Case,
  executionId: string,
  recoveryProbability: number
): Promise<void> {
  const supabase = getServiceClient();
  const call = simulateVoiceCall({ caseId: c.id, amount: c.amount, recoveryProbability });

  let audioUrl: string | null = null;
  if (elevenLabsConfigured()) {
    try {
      const script = buildCollectionsScript({
        customerName: c.customer_name,
        amount: c.amount,
        riskType: c.risk_type,
        contactAttempts: c.contact_attempts,
        language: resolveVoiceLanguage(),
      });
      const audio = await synthesizeSpeech(script);
      audioUrl = await uploadCallAudio(c.id, audio);
    } catch (err) {
      // Real audio is a bonus artifact, not load-bearing — a synthesis/
      // upload failure falls back to pure simulation rather than failing
      // the whole case.
      audioUrl = null;
      console.error(`recordVoiceInteraction: ElevenLabs synthesis failed for case ${c.id}:`, err);
    }
  }

  const { data: voiceInteraction, error } = await supabase
    .from("voice_interactions")
    .insert({
      case_id: c.id,
      execution_id: executionId,
      provider: "simulated",
      call_status: call.call_status,
      duration_seconds: call.duration_seconds,
      outcome: call.outcome,
      transcript_summary: call.transcript_summary,
      audio_url: audioUrl,
    })
    .select()
    .single();
  if (error || !voiceInteraction) throw new Error(`recordVoiceInteraction: failed to persist call: ${error?.message}`);

  if (call.promiseToPay) {
    const promisedDate = new Date(Date.now() + call.promiseToPay.promisedInDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const { error: ptpError } = await supabase.from("promises_to_pay").insert({
      case_id: c.id,
      voice_interaction_id: voiceInteraction.id,
      promised_amount: call.promiseToPay.promisedAmount,
      promised_date: promisedDate,
      status: "pending",
    });
    if (ptpError) throw new Error(`recordVoiceInteraction: failed to persist promise-to-pay: ${ptpError.message}`);
  }
}
