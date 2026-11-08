import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.url().refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use the PostgreSQL protocol",
  ),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
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
