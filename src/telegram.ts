import axios from "axios";
import OpenAI, { toFile } from "openai";
import { env } from "./config";

const baseUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
  audio?: { file_id: string };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<void> {
  await axios.post(`${baseUrl}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
  });
}

async function sendChatAction(chatId: string | number): Promise<void> {
  await axios.post(`${baseUrl}/sendChatAction`, {
    chat_id: chatId,
    action: "typing",
  });
}

export async function withTypingIndicator<T>(
  chatId: string | number,
  fn: () => Promise<T>
): Promise<T> {
  await sendChatAction(chatId);
  const interval = setInterval(() => {
    sendChatAction(chatId).catch(() => {});
  }, 4500);

  try {
    return await fn();
  } finally {
    clearInterval(interval);
  }
}

async function downloadFile(fileId: string): Promise<Buffer> {
  const { data: fileMeta } = await axios.get<{
    ok: boolean;
    result?: { file_path: string };
  }>(`${baseUrl}/getFile`, { params: { file_id: fileId } });

  const filePath = fileMeta.result?.file_path;
  if (!fileMeta.ok || !filePath) {
    throw new Error(`Failed to resolve Telegram file: ${fileId}`);
  }

  const { data } = await axios.get<ArrayBuffer>(
    `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`,
    { responseType: "arraybuffer" }
  );

  return Buffer.from(data);
}

async function transcribeVoice(fileId: string): Promise<string> {
  const audio = await downloadFile(fileId);
  const file = await toFile(audio, "voice.ogg", { type: "audio/ogg" });
  const { text } = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });
  return text.trim();
}

export async function resolveUserInput(
  message: TelegramMessage
): Promise<string | null> {
  const text = message.text?.trim();
  if (text) return text;

  const voice = message.voice ?? message.audio;
  if (voice) return transcribeVoice(voice.file_id);

  return null;
}
