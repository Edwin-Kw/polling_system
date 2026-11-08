import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("polling-api"),
  database: z.literal("connected"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorCodeSchema = z.enum([
  "INVALID_REQUEST", "NOT_FOUND", "ALREADY_VOTED", "POLL_CLOSED",
  "SIMULATED_FAILURE", "DATABASE_UNAVAILABLE", "INTERNAL_ERROR",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorResponseSchema = z.object({
  error: z.object({ code: apiErrorCodeSchema, message: z.string() }),
});

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export const pollOptionSchema = z.object({ id: z.uuid(), label: z.string().min(1) });
export type PollOption = z.infer<typeof pollOptionSchema>;

export const pollSchema = z.object({
  id: z.uuid(),
  question: z.string().min(1),
  options: z.array(pollOptionSchema).min(1),
});
export type Poll = z.infer<typeof pollSchema>;

export interface VoteRequest {
  optionId: string;
}

export const voteResponseSchema = z.object({ pollId: z.uuid(), optionId: z.uuid() });
export type VoteResponse = z.infer<typeof voteResponseSchema>;

export interface OptionResult extends PollOption {
  count: number;
}

export const pollResultsSchema = z.object({
  pollId: z.uuid(),
  active: z.boolean(),
  options: z.array(pollOptionSchema.extend({ count: z.number().int().nonnegative().safe() })).min(1),
  totalVotes: z.number().int().nonnegative().safe(),
  myVote: z.uuid().nullable(),
}).refine((results) =>
  results.totalVotes === results.options.reduce((sum, option) => sum + option.count, 0)
  && new Set(results.options.map((option) => option.id)).size === results.options.length
  && (results.myVote === null || results.options.some((option) => option.id === results.myVote && option.count > 0)),
  "Inconsistent poll results",
);
export type PollResults = z.infer<typeof pollResultsSchema>;

export const pollChangedSchema = z.object({ pollId: z.uuid() }).strict();
export type PollChanged = z.infer<typeof pollChangedSchema>;

export interface ServerToClientEvents {
  "poll:changed": (event: PollChanged) => void;
}
export type ClientToServerEvents = Record<string, never>;

export { deriveResults } from "./results.ts";
