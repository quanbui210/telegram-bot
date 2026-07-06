import express from "express";
import cors from "cors";
import { telegramRouter } from "./routes/telegram";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("Telegram");
});

app.use("/api", telegramRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
