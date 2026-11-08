import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("polling-api"),
  database: z.literal("connected"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "ALREADY_VOTED"
  | "POLL_CLOSED"
  | "SIMULATED_FAILURE"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface PollOption {
  id: string;
  label: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
}

export interface VoteRequest {
  optionId: string;
}

export interface VoteResponse {
  pollId: string;
  optionId: string;
}

export interface OptionResult extends PollOption {
  count: number;
}

export interface PollResults {
  pollId: string;
  options: OptionResult[];
  totalVotes: number;
  myVote: string | null;
}
