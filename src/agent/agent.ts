import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { tools } from "../tools";
import { withTypingIndicator } from "../services/telegram";
import { SYSTEM_PROMPT } from "./prompts";

const checkpointer = new MemorySaver();

export const agent = createAgent({
  model: "openai:gpt-4o",
  tools,
  checkpointer,
  systemPrompt: SYSTEM_PROMPT,
});

function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "text" &&
    "text" in block &&
    typeof block.text === "string"
  );
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content);

  return content
    .map((block) =>
      typeof block === "string" ? block : isTextBlock(block) ? block.text : ""
    )
    .join("");
}

export async function chat(
  question: string,
  chatId: string | number
): Promise<string> {
  return withTypingIndicator(chatId, async () => {
    const result = await agent.invoke(
      { messages: [{ role: "human", content: question }] },
      { configurable: { thread_id: String(chatId) } }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    return extractTextContent(lastMessage.content);
  });
}
