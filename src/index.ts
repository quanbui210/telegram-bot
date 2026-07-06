import express from 'express';
import cors from 'cors';
import { env } from './config/environment';
import { createAgent } from "langchain";
import * as z from "zod"
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const simpleChat = async (question: string) => {
  const agent = createAgent({
    model: "openai:gpt-4o",
    tools: []
  })

  const result = await agent.invoke({
    messages: [{
      role: "human",
      content: question
    }]
  })

  return result.messages[1].content
}






app.get("/", (req, res) => {
  res.send("Telegram")
})
app.post("/chat", async (req, res) => {
  const {question} = req.body
  const result = await simpleChat(question)
  console.log("RESULT: ", result)
  res.json({status: "ok", message: result})
})
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
