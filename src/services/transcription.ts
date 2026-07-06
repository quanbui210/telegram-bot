import OpenAI, { toFile } from "openai";
import { env } from "../config/environment";
import { downloadTelegramFile } from "./telegram";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function transcribeAudio(
  audio: Buffer,
  filename = "voice.ogg"
): Promise<string> {
  const file = await toFile(audio, filename, { type: "audio/ogg" });

  const { text } = await openai.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file,
  });

  return text.trim();
}

export async function transcribeTelegramVoice(fileId: string): Promise<string> {
  const audio = await downloadTelegramFile(fileId);
  return transcribeAudio(audio);
}