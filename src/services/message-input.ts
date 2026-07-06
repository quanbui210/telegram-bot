import type { TelegramMessage } from "../types/telegram";
import { transcribeTelegramVoice } from "./transcription";

export async function resolveUserInput(
  message: TelegramMessage
): Promise<string | null> {
  const text = message.text?.trim();
  if (text) return text;

  const voice = message.voice ?? message.audio;
  if (voice) {
    return transcribeTelegramVoice(voice.file_id);
  }

  return null;
}