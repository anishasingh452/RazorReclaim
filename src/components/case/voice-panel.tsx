import { AudioLines, PhoneCall, Sparkles } from "lucide-react";
import {
  PROMISE_STATUS_COLOR,
  PROMISE_STATUS_LABEL,
  VOICE_OUTCOME_COLOR,
  VOICE_OUTCOME_LABEL,
  VOICE_STATUS_LABEL,
  formatInrPrecise,
} from "@/lib/display";
import type { PromiseToPay, VoiceInteraction } from "@/types/domain";

/**
 * Voice interactions, with the real/simulated line drawn explicitly: the
 * call outcome is simulated (no telephony provider), but when an audio_url
 * is present the speech itself was genuinely synthesized by ElevenLabs and
 * is playable here. Never let a simulated artifact look like a real one.
 */
export function VoicePanel({
  interactions,
  promises,
}: {
  interactions: VoiceInteraction[];
  promises: PromiseToPay[];
}) {
  return (
    <div className="space-y-3">
      {interactions.map((call, i) => {
        const callPromises = promises.filter((p) => p.voice_interaction_id === call.id);

        return (
          <div
            key={call.id}
            className="rise glass space-y-3.5 p-4"
            style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-teal-500/25 bg-teal-500/10 text-teal-300">
                <PhoneCall className="size-4" />
              </span>
              <div className="mr-auto">
                <div className="text-[13px] font-medium">{VOICE_STATUS_LABEL[call.call_status]}</div>
                <div className="micro-label mt-0.5">
                  {call.duration_seconds}s · {new Date(call.created_at).toLocaleString("en-IN")}
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${VOICE_OUTCOME_COLOR[call.outcome]}`}
              >
                {VOICE_OUTCOME_LABEL[call.outcome]}
              </span>
            </div>

            {call.transcript_summary && (
              <p className="inset-panel p-3 text-xs leading-relaxed text-muted-foreground">
                {call.transcript_summary}
              </p>
            )}

            {call.audio_url ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-teal-300 uppercase">
                    <Sparkles className="size-3" />
                    Real ElevenLabs audio
                  </span>
                  <span className="text-[10.5px] text-muted-foreground/60">
                    Speech genuinely synthesized · call outcome simulated
                  </span>
                </div>
                {/* Native controls: fully accessible and keyboard-operable
                    without shipping a custom player for one element. */}
                <audio controls preload="metadata" src={call.audio_url} className="w-full">
                  Your browser does not support audio playback.
                </audio>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <AudioLines className="size-3.5" />
                Simulated call — no audio artifact generated
              </div>
            )}

            {callPromises.map((promise) => (
              <div
                key={promise.id}
                className="inset-panel flex flex-wrap items-center gap-x-3 gap-y-1 border-emerald-500/15 px-3 py-2.5"
              >
                <span className="micro-label text-emerald-300/80">Promise to pay</span>
                <span className="stat-value text-sm font-semibold text-emerald-300">
                  {formatInrPrecise(promise.promised_amount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  by {new Date(promise.promised_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span
                  className={`ml-auto inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${PROMISE_STATUS_COLOR[promise.status]}`}
                >
                  {PROMISE_STATUS_LABEL[promise.status]}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
