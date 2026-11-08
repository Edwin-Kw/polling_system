import express from "express";
import type { ApiErrorResponse, HealthResponse } from "@polling/shared";

export interface AppDependencies {
  checkDatabase: () => Promise<void>;
  logError: (message: string, error: unknown) => void;
  staticDirectory?: string;
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

  const errorHandler: express.ErrorRequestHandler = (
    error: unknown,
    _request,
    response,
    _next,
  ) => {
    dependencies.logError("HTTP request failed", error);
    const malformedJson = error instanceof SyntaxError
      && "type" in error
      && error.type === "entity.parse.failed";
    response.status(malformedJson ? 400 : 500).json({
      error: {
        code: malformedJson ? "INVALID_REQUEST" : "INTERNAL_ERROR",
        message: malformedJson ? "Request body must be valid JSON." : "Unexpected server error.",
      },
    } satisfies ApiErrorResponse);
  };

  app.use(errorHandler);
  return app;
}
