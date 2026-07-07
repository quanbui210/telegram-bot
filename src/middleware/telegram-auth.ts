import type { Request, Response, NextFunction } from "express";
import { env } from "../config/environment";

export function verifyTelegramSecret(
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
