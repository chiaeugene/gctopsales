import OpenAI, { toFile } from "openai";

// Voice-note transcription. Malaysian WhatsApp customers send voice messages
// constantly, so GC transcribes inbound audio and sells from it. Claude has no
// audio input, so this uses a Whisper service via the openai SDK (already a
// dependency). Opt-in: only active when a transcription key is configured;
// otherwise the caller gracefully hands the voice note to a human.
//
// Provider resolution (Groq preferred — fast + cheap Whisper on an
// OpenAI-compatible API):
//   1. GROQ_API_KEY  → Groq, default model whisper-large-v3-turbo
//   2. TRANSCRIBE_API_KEY / OPENAI_API_KEY → OpenAI, default model whisper-1
// Model override via GC_TRANSCRIBE_MODEL. Best-effort — never throws.

// WhatsApp voice notes are audio/ogg (opus); other channels/uploads may send
// mp3/m4a/wav/webm. Whisper handles all of these.
const AUDIO_MIMES = new Set([
  "audio/ogg",
  "audio/oga",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/amr",
  "audio/3gpp",
]);

export function inboundAudioMimeOk(mimeType: string): boolean {
  return AUDIO_MIMES.has(mimeType.split(";")[0].trim().toLowerCase());
}

// Resolves the transcription provider: Groq first (fast/cheap Whisper), then
// OpenAI. Returns null if none configured.
function transcribeProvider(): { apiKey: string; baseURL?: string; defaultModel: string } | null {
  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      defaultModel: "whisper-large-v3-turbo",
    };
  }
  const openaiKey = process.env.TRANSCRIBE_API_KEY || process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { apiKey: openaiKey, defaultModel: "whisper-1" };
  }
  return null;
}

export function transcribeConfigured(): boolean {
  return transcribeProvider() !== null;
}

function extForMime(mimeType: string): string {
  const m = mimeType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/oga": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/amr": "amr",
    "audio/3gpp": "3gp",
  };
  return map[m] || "ogg";
}

// Returns the transcribed text, or null if transcription is not configured or
// fails. Callers must treat null as "couldn't transcribe" and hand to a human.
export async function transcribeAudio(opts: {
  data: Uint8Array;
  mimeType: string;
  fileName?: string;
}): Promise<string | null> {
  const provider = transcribeProvider();
  if (!provider) return null;
  if (!inboundAudioMimeOk(opts.mimeType)) return null;

  try {
    const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL });
    const model = process.env.GC_TRANSCRIBE_MODEL || provider.defaultModel;
    const fileName = opts.fileName || `voice.${extForMime(opts.mimeType)}`;
    const file = await toFile(Buffer.from(opts.data), fileName, { type: opts.mimeType.split(";")[0].trim() });

    const res = await client.audio.transcriptions.create({
      file,
      model,
      // Let Whisper auto-detect language (EN / Malay / Mandarin all common).
    });
    const text = (res.text || "").trim();
    return text || null;
  } catch (err) {
    console.error("[transcribe] failed (non-fatal)", err);
    return null;
  }
}
