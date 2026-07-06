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

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          typeof block === "object" &&
          block !== null &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          return block.text;
        }
        return "";
      })
      .join("");
  }

  return String(content);
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
