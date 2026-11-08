import { describe, expect, it } from "vitest";
import { API_BASE_PATH, SOCKET_PATH, MOCK_USER_HEADER, POLL_CHANGED_EVENT, apiPaths, pollRoutes } from "./transport.ts";

describe("shared transport contract", () => {
  it("preserves the published routes, header, and event names", () => {
    expect(API_BASE_PATH).toBe("/api");
    expect(SOCKET_PATH).toBe("/socket.io");
    expect(MOCK_USER_HEADER).toBe("X-Mock-User-Id");
    expect(POLL_CHANGED_EVENT).toBe("poll:changed");
    expect(apiPaths.health).toBe("/api/health");
    expect(apiPaths.polls).toBe("/api/polls");
    expect(apiPaths.activePoll).toBe("/api/polls/active");
    expect(apiPaths.results("test-id")).toBe("/api/polls/test-id/results");
    expect(apiPaths.votes("test-id")).toBe("/api/polls/test-id/votes");
  });
  it("derives client paths from router patterns and encodes IDs as one path segment", () => {
    for (const key of ["results", "votes"] as const) {
      expect(apiPaths[key]("poll/id?")).toBe(`${apiPaths.polls}${pollRoutes[key].replace(":pollId", "poll%2Fid%3F")}`);
    }
  });
});
