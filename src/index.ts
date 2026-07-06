import express from "express";
import cors from "cors";
import { env } from "./config/environment";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { tools } from "./tools";
import axios from "axios";
import { SYSTEM_PROMPT } from "./agent/prompts";
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const checkpointer = new MemorySaver();

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: tools,
  checkpointer,
  systemPrompt: SYSTEM_PROMPT
});

const simpleChat = async (question: string) => {
  const result = await agent.invoke({
    messages: [{
      role: "human",
      content: question
    }]
  }, {
    configurable: {
      thread_id: "1"
    }
  });
  
 
  const lastMessage = result.messages[result.messages.length - 1];
  return lastMessage.content;
}






app.get("/", (req, res) => {
  res.send("Telegram")
})

app.post("/chat", async (req, res) => {
  const {question} = req.body
  const result = await simpleChat(question)
  res.json({status: "ok", message: result})
})


app.post("/api/telegram", async (req,res) => {
  const update = req.body;
  const message = update.message;

  const text = message?.text || message?.chat?.text;
  
  if (!message || !message.chat || !text) {
    res.status(200).send("OK");
    return;
  }

  const chatId = message.chat.id;
  const userText = text.trim();
{
      try {
        const result = await simpleChat(userText);
        
        const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(telegramApiUrl, {
          chat_id: chatId,
          text: result,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error("Failed to process agent chat", error);
      }
  }
    
  res.status(200).send("OK");
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
