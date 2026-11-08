import { Router } from "express";
import { z } from "zod";
import type { PollRepository } from "../db/pollRepository.ts";
import { createVoteService, PollError } from "../services/voteService.ts";

const idSchema = z.uuid();
const userSchema = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const voteSchema = z.object({ optionId: idSchema }).strict();

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new PollError(400, "INVALID_REQUEST", "Invalid request. Check your user ID, poll ID, and selected option.");
  return parsed.data;
}

export function createPollRoutes(
  repository: PollRepository, shouldFail: () => boolean, notifyPollChanged: (pollId: string) => void,
) {
  const router = Router();
  const submitVote = createVoteService(repository, shouldFail);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });
  router.get("/active", async (request, response) => {
    validate(userSchema, request.get("X-Mock-User-Id"));
    const poll = await repository.getActivePoll();
    if (!poll) throw new PollError(404, "NOT_FOUND", "No active poll is available.");
    response.json(poll);
  });
  router.get("/:pollId/results", async (request, response) => {
    const pollId = validate(idSchema, request.params.pollId);
    const userId = validate(userSchema, request.get("X-Mock-User-Id"));
    const results = await repository.getResults(pollId, userId);
    if (!results) throw new PollError(404, "NOT_FOUND", "This poll no longer exists.");
    response.json(results);
  });
  router.post("/:pollId/votes", async (request, response) => {
    const pollId = validate(idSchema, request.params.pollId);
    const userId = validate(userSchema, request.get("X-Mock-User-Id"));
    const body: unknown = request.body;
    const { optionId } = validate(voteSchema, body);
    const vote = await submitVote(pollId, optionId, userId);
    notifyPollChanged(pollId);
    response.status(201).json(vote);
  });
  return router;
}
