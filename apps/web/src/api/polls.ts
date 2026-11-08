import { z } from "zod";
import {
  activePollsSchema, apiErrorResponseSchema, pollResultsSchema, pollSchema, voteResponseSchema,
} from "@polling/shared";
import type { ApiErrorCode, Poll, PollResults, VoteResponse } from "@polling/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface PollApi {
  getActivePoll(userId: string, signal: AbortSignal): Promise<Poll>;
  getActivePolls(userId: string, signal: AbortSignal): Promise<Poll[]>;
  getResults(pollId: string, userId: string, signal: AbortSignal): Promise<PollResults>;
  submitVote(pollId: string, optionId: string, userId: string, signal: AbortSignal): Promise<VoteResponse>;
}

async function send<T>(
  path: string, userId: string, signal: AbortSignal, schema: z.ZodType<T>,
  expectedStatus: number, body?: { optionId: string },
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: { "X-Mock-User-Id": userId, ...(body ? { "Content-Type": "application/json" } : {}) },
      signal: controller.signal,
      cache: "no-store",
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data: unknown = await response.json();
    if (!response.ok) {
      const parsed = apiErrorResponseSchema.parse(data);
      throw new ApiError(response.status, parsed.error.code, parsed.error.message);
    }
    if (response.status !== expectedStatus) throw new Error(`Unexpected HTTP status ${response.status}`);
    return schema.parse(data);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export const pollApi: PollApi = {
  getActivePoll: (userId, signal) => send("/api/polls/active", userId, signal, pollSchema, 200),
  getActivePolls: (userId, signal) => send("/api/polls", userId, signal, activePollsSchema, 200),
  getResults: (pollId, userId, signal) =>
    send(`/api/polls/${pollId}/results`, userId, signal, pollResultsSchema, 200),
  submitVote: (pollId, optionId, userId, signal) =>
    send(`/api/polls/${pollId}/votes`, userId, signal, voteResponseSchema, 201, { optionId }),
};
