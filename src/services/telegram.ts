import axios from "axios";
import { env } from "../config/environment";

const baseUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

type ChatAction = "typing" | "upload_voice";

export async function sendChatAction(
  chatId: string | number,
  action: ChatAction = "typing"
): Promise<void> {
  await axios.post(`${baseUrl}/sendChatAction`, { chat_id: chatId, action });
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

export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
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
