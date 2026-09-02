-- Real ElevenLabs TTS audio for simulated voice calls (Option A: real audio
-- artifact, no telephony). Nullable — null means this interaction used pure
-- simulation (no ELEVENLABS_API_KEY configured, or generation failed), a
-- populated URL means the audio backing this call is genuinely synthesized.
alter table voice_interactions add column audio_url text;
