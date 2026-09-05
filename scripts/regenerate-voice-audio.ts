import { config } from "dotenv";
config({ path: ".env.local" });

import { getServiceClient } from "@/lib/db/service-client";
import { buildCollectionsScript } from "@/lib/voice/collections-script";
import { elevenLabsConfigured, synthesizeSpeech, uploadCallAudio } from "@/lib/voice/elevenlabs";

/**
 * Re-synthesizes the audio for existing voice interactions using the current
 * voice and script configuration, and repoints the interaction at the new
 * file.
 *
 * This exists because the audio is a rendered artifact of settings that can
 * change — voice id, model, script language — while the interaction it hangs
 * off is a historical record that must not. So this only ever replaces
 * `voice_interactions.audio_url`: it never touches the call outcome, the
 * transcript, the linked execution, any promise-to-pay, or the audit chain.
 * Old files are left in storage rather than deleted, so a regeneration is
 * always reversible.
 *
 *   npx tsx scripts/regenerate-voice-audio.ts <caseId> [<caseId> ...]
 */
async function main() {
  const caseIds = process.argv.slice(2);
  if (caseIds.length === 0) {
    console.error("Usage: npx tsx scripts/regenerate-voice-audio.ts <caseId> [<caseId> ...]");
    process.exit(1);
  }
  if (!elevenLabsConfigured()) {
    console.error("ELEVENLABS_API_KEY is not set — nothing to regenerate.");
    process.exit(1);
  }

  const supabase = getServiceClient();

  for (const caseId of caseIds) {
    const { data: c, error: caseErr } = await supabase
      .from("cases")
      .select("id, customer_name, amount, risk_type, contact_attempts")
      .eq("id", caseId)
      .single();
    if (caseErr || !c) {
      console.error(`  ✗ ${caseId}: case not found (${caseErr?.message})`);
      continue;
    }

    const { data: calls, error: callErr } = await supabase
      .from("voice_interactions")
      .select("id, audio_url")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    if (callErr || !calls?.length) {
      console.error(`  ✗ ${c.customer_name}: no voice interaction on this case`);
      continue;
    }

    const script = buildCollectionsScript({
      customerName: c.customer_name,
      amount: c.amount,
      riskType: c.risk_type,
      contactAttempts: c.contact_attempts,
    });

    console.log(`\n${c.customer_name} — ₹${c.amount.toLocaleString("en-IN")} ${c.risk_type}`);
    console.log(`  script: ${script}`);

    const audio = await synthesizeSpeech(script);
    const audioUrl = await uploadCallAudio(caseId, audio);

    for (const call of calls) {
      const { error } = await supabase
        .from("voice_interactions")
        .update({ audio_url: audioUrl })
        .eq("id", call.id);
      if (error) {
        console.error(`  ✗ failed to update interaction ${call.id}: ${error.message}`);
        continue;
      }
      console.log(`  ✓ ${(audio.length / 1024).toFixed(0)} KB → ${audioUrl}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
