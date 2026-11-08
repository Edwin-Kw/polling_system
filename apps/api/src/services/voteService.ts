import type { ApiErrorCode, VoteResponse } from "@polling/shared";
import type { PollRepository } from "../db/pollRepository.ts";

export class PollError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createVoteService(repository: PollRepository, shouldFail: () => boolean) {
  return async (pollId: string, optionId: string, userId: string): Promise<VoteResponse> => {
    const poll = await repository.getPoll(pollId);
    if (!poll) throw new PollError(404, "NOT_FOUND", "This poll no longer exists.");
    if (!poll.active) throw new PollError(409, "POLL_CLOSED", "This poll is closed.");
    if (!poll.options.some((option) => option.id === optionId)) {
      throw new PollError(400, "INVALID_REQUEST", "Choose an option from this poll.");
    }
    if (shouldFail()) throw new PollError(500, "SIMULATED_FAILURE", "Your vote wasn't saved. Please try again.");
    if (!await repository.insertVote(pollId, optionId, userId)) {
      const current = await repository.getPoll(pollId);
      if (!current) throw new PollError(404, "NOT_FOUND", "This poll no longer exists.");
      if (!current.active) throw new PollError(409, "POLL_CLOSED", "This poll is closed.");
      throw new PollError(409, "ALREADY_VOTED", "You have already voted in this poll.");
    }
    return { pollId, optionId };
  };
}
