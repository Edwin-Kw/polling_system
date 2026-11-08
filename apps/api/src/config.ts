import { z } from "zod";
import { serverAddressSchema } from "@polling/shared/development";

const environmentSchema = serverAddressSchema.extend({
  DATABASE_URL: z.url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use the PostgreSQL protocol",
  ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VOTE_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.15),
});

export function readConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server configuration: ${details}`);
  }

  return parsed.data;
}
