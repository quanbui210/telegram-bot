import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("3000"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1, "TELEGRAM_WEBHOOK_SECRET is required"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_ENDPOINT: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),
  LANGCHAIN_API_KEY: z.string().optional(),
  LANGCHAIN_TRACING_V2: z.string().optional(),
  LANGCHAIN_PROJECT: z.string().optional(),
  GOOGLE_CREDENTIALS_JSON: z.string().optional(),
  GOOGLE_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string(),
  DB_PATH: z.string().default("./data/portfolio.db"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

function bootstrapLangSmith(data: z.infer<typeof envSchema>): void {
  const apiKey = (data.LANGSMITH_API_KEY || data.LANGCHAIN_API_KEY)?.trim();
  const tracingEnabled =
    (data.LANGSMITH_TRACING ?? data.LANGCHAIN_TRACING_V2 ?? "false") === "true";

  if (!apiKey || !tracingEnabled) {
    console.warn("LangSmith tracing disabled (missing API key or tracing flag)");
    return;
  }

  const project = (
    data.LANGSMITH_PROJECT ||
    data.LANGCHAIN_PROJECT ||
    "telegram-bot"
  ).trim();
  const endpoint =
    data.LANGSMITH_ENDPOINT ?? "https://eu.api.smith.langchain.com";

  process.env.LANGSMITH_TRACING = "true";
  process.env.LANGSMITH_API_KEY = apiKey;
  process.env.LANGSMITH_PROJECT = project;
  process.env.LANGSMITH_ENDPOINT = endpoint;
  process.env.LANGCHAIN_TRACING_V2 = "true";
  process.env.LANGCHAIN_API_KEY = apiKey;
  process.env.LANGCHAIN_PROJECT = project;
  process.env.LANGCHAIN_ENDPOINT = endpoint;
  process.env.LANGCHAIN_CALLBACKS_BACKGROUND = "false";

  console.log(`LangSmith tracing enabled → project: ${project}, endpoint: ${endpoint}`);
}

bootstrapLangSmith(parsed.data);

export const env = parsed.data;
