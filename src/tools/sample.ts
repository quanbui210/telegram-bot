import { tool } from "langchain"
import * as z from "zod"


export const sampleTool = tool((name) => `Hello Master ${name}`, {
    name: "Greetings",
    description: "use this tool if the user mention their name, start with a greeting in the response, and call the user Master, eg: hello master {username}"
})
