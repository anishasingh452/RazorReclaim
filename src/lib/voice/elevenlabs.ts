import { getServiceClient } from "@/lib/db/service-client";

// "Bella — Professional, Bright, Warm". A recovery call has to sound like a
// person who wants to help rather than a dunning notice, so warmth matters as
// much as clarity here. The previous default paired an entertainment-tuned
// voice with romanised Hinglish, which the multilingual model pronounced using
// English phonetics and rendered close to unintelligible; scripts now default
// to English (see collections-script.ts) and this voice reads them cleanly
// through a room's speakers.
//
// Must be a voice the account can actually reach — library voices return 402
// on the free tier, so this is one of the always-available premade voices.
const DEFAULT_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us";
const STORAGE_BUCKET = "voice-recordings";

export function elevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/** Real ElevenLabs TTS call — synthesizes the given collections script into speech. */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  // 128kbps rather than the API default, so the recording still sounds clean
  // through a projector's speakers. The multilingual model is kept because
  // the Hindi and Hinglish script options still route through here.
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        // Higher stability and speaker boost trade a little expressiveness for
        // even, intelligible delivery — the right trade for a business call.
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.8,
          style: 0.1,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

let bucketEnsured = false;

/** Creates the voice-recordings storage bucket if it doesn't already exist (idempotent, cheap to call repeatedly). */
async function ensureVoiceBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getServiceClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === STORAGE_BUCKET)) {
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
    // Ignore "already exists" races from concurrent case executions.
    if (error && !error.message.includes("already exists")) throw error;
  }
  bucketEnsured = true;
}

/** Uploads synthesized call audio to Supabase Storage and returns its public URL. */
export async function uploadCallAudio(caseId: string, audio: Buffer): Promise<string> {
  await ensureVoiceBucket();
  const supabase = getServiceClient();
  const path = `${caseId}/${Date.now()}.mp3`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, audio, {
    contentType: "audio/mpeg",
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload voice audio: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
