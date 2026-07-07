import { Router } from "express";
import { chat } from "../agent/graph";
import { verifyTelegramSecret } from "../middleware/telegram-auth";
import { resolveUserInput } from "../services/message-input";
import { sendMessage } from "../services/telegram";
import type { TelegramUpdate } from "../types/telegram";

export const telegramRouter = Router();

telegramRouter.post("/telegram", verifyTelegramSecret, async (req, res) => {
  const update = req.body as TelegramUpdate;
  const message = update.message;

  if (!message?.chat) {
    res.status(200).send("OK");
    return;
  }

  const chatId = message.chat.id;
  res.status(200).send("OK");

  try {
    const userText = await resolveUserInput(message);
    if (!userText) return;

    const result = await chat(userText, chatId);
    await sendMessage(chatId, result);
  } catch (error) {
    console.error("Failed to process Telegram update", error);
  }
});
