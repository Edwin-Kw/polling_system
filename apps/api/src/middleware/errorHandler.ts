import type { ErrorRequestHandler } from "express";
import type { ApiErrorResponse } from "@polling/shared";
import { PollError } from "../services/voteService.ts";

export function createErrorHandler(logError: (message: string, error: unknown) => void): ErrorRequestHandler {
  return (error: unknown, _request, response, _next) => {
    if (error instanceof PollError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message },
      } satisfies ApiErrorResponse);
      return;
    }
    logError("HTTP request failed", error);
    const malformedJson = error instanceof SyntaxError
      && "type" in error && error.type === "entity.parse.failed";
    response.status(malformedJson ? 400 : 500).json({
      error: {
        code: malformedJson ? "INVALID_REQUEST" : "INTERNAL_ERROR",
        message: malformedJson ? "Request body must be valid JSON." : "Unexpected server error.",
      },
    } satisfies ApiErrorResponse);
  };
}
