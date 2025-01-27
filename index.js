import { ilike } from "drizzle-orm";
import OpenAI from "openai";
import readlineSync from "readline-sync";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tools
async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

async function createTodo(todo) {
  const [result] = await db.insert(todosTable).values({ todo }).returning({
    id: todosTable.id,
  });

  return result.id;
}

async function searchTodo(search) {
  return await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
}

async function deleteTodoById(id) {
  return db.delete(todosTable).where(todosTable.id.eq(id));
}

const tools = {
  getAllTodos,
  createTodo,
  searchTodo,
  deleteTodoById,
};

const SYSTEM_PROMPT = `

You are an AI assistant that helps users manage their todo list with START, PLAN, ACTION, Observation and Output State.
Wait for the user prompt and first PLAN using available tools.
After Planning, Take the action appropriate tools and wait for Observation based on Action.
Once you get the observations, Return the AI response based on START prompt and observations

You can manage tasks by adding, viewing, updating, and deleting them. 
You must strictly follow the JSON output format.

Todo DB Schema:
id: Int and is the primary key
todo: String
created_at: Date Time
updated_at: Date Time

Available Tools:
- getAllTodos(): Return all todos from database
- createTodo(todo: string): Create a new todo in the database and takes todo as a string and returns the ID of the created todo
- searchTodo(query: string): Search for a all todos matching the query string using iLike operator in the database
- deleteTodoById(id: string): Delete a todo by ID given in the db

Expample:
START
{"type": "user", "user":"Add a task for shopping groceries."}
{"type": "plan", "plan":"I will try to get more context on what user needs to shop."}
{"type": "output", "output":"Can you tell me what all items you want to shop for?"}
{"type": "user", "user":"I want to shop for milk, eggs, and bread."}
{"type": "plan", "plan":"I will use createTodo to create a new todo in DB."}
{"type": "action", "function":"createTodo", "input": "Shopping Groceries milk, eggs, and bread."}
{"type": "observation", "observation": "2"}
{"type": "output", "output":"Your todo has been created successfully."}
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

while (true) {
  const query = readlineSync.question(">> ");
  const userMessage = {
    type: "user",
    user: query,
  };
  messages.push({ role: "user", content: JSON.stringify(userMessage) });

  while (true) {
    const chat = await client.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages,
      response_format: { type: "json_object" },
    });

    const result = chat.choices[0].message.content;
    messages.push({ role: "assistant", content: result });

    const response = JSON.parse(result);

    if (response.type === "output") {
      console.log(`🤖: ${response.output}`);
      break;
    } else if (response.type === "action") {
      const fn = tools[action.function];
      if (!fn) throw new Error("Invalid Tool Call.");

      const observation = await fn(action.input);
      const observationMessage = {
        type: "observation",
        observation,
      };

      messages.push({
        role: "developer",
        content: JSON.stringify(observationMessage),
      });
    }
  }
}
