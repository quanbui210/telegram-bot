import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { env } from "./config";
import { chat } from "./agent/index";
import { initDb } from "./tools/portfolio";
import {
  resolveUserInput,
  sendMessage,
  type TelegramUpdate,
} from "./telegram";

initDb();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function verifyTelegramSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.header("X-Telegram-Bot-Api-Secret-Token");
  if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).send("Unauthorized");
    return;
  }
  next();
}

app.get("/", (_req, res) => {
  res.send("Telegram");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/telegram", verifyTelegramSecret, async (req, res) => {
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

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
