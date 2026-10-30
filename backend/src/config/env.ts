import "dotenv/config";
import { z } from "zod";
const schema = z.object({
 NODE_ENV:z.enum(["development","test","production"]).default("development"),
 PORT:z.coerce.number().int().positive().default(8000),
 FRONTEND_ORIGIN:z.string().url().default("http://localhost:5173"),
 DATABASE_URL:z.string().min(1), JWT_SECRET:z.string().min(32),
 OPENAI_API_KEY:z.string().optional().default(""), OPENAI_MODEL:z.string().default("gpt-4.1-mini"),
 OPENAI_INPUT_USD_PER_1M:z.coerce.number().nonnegative().default(0),
 OPENAI_OUTPUT_USD_PER_1M:z.coerce.number().nonnegative().default(0)
});
export const env=schema.parse(process.env);
