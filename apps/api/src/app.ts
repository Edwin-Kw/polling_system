import express from "express";
import type { ApiErrorResponse, HealthResponse } from "@polling/shared";
import type { PollRepository } from "./db/pollRepository.ts";
import { createPollRoutes } from "./routes/polls.ts";
import { createErrorHandler } from "./middleware/errorHandler.ts";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  logError: (message: string, error: unknown) => void;
  staticDirectory?: string;
  repository: PollRepository;
  shouldFailVote: () => boolean;
  notifyPollChanged?: (pollId: string) => void;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/health", async (_request, response) => {
    try {
      await dependencies.checkDatabase();
      response.json({
        status: "ok",
        service: "polling-api",
        database: "connected",
      } satisfies HealthResponse);
    } catch (error) {
      dependencies.logError("Database health check failed", error);
      response.status(503).json({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "PostgreSQL is unavailable. Check the database connection.",
        },
      } satisfies ApiErrorResponse);
    }
  });

  app.use("/api/polls", createPollRoutes(
    dependencies.repository,
    dependencies.shouldFailVote,
    (pollId) => {
      try {
        dependencies.notifyPollChanged?.(pollId);
      } catch (error) {
        dependencies.logError("Vote saved but live notification failed", error);
      }
    },
  ));

  app.use("/api", (_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "API endpoint not found." },
    } satisfies ApiErrorResponse);
  });

  if (dependencies.staticDirectory) {
    app.use(express.static(dependencies.staticDirectory));
  }

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Resource not found." },
    } satisfies ApiErrorResponse);
  });

  app.use(createErrorHandler(dependencies.logError));
  return app;
}
