import { getServiceClient } from "@/lib/db/service-client";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // "Sarah" — mature, reassuring, confident; multilingual model handles the Hinglish text
const STORAGE_BUCKET = "voice-recordings";

export function elevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/** Real ElevenLabs TTS call — synthesizes the given Hinglish script into speech. */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

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
