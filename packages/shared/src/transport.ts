export const API_BASE_PATH = "/api";
export const SOCKET_PATH = "/socket.io";
export const MOCK_USER_HEADER = "X-Mock-User-Id";
export const POLL_CHANGED_EVENT = "poll:changed";

export const pollRoutes = {
  list: "/",
  active: "/active",
  results: "/:pollId/results",
  votes: "/:pollId/votes",
} as const;

const pollsPath = `${API_BASE_PATH}/polls`;
export const apiPaths = {
  health: `${API_BASE_PATH}/health`,
  polls: pollsPath,
  activePoll: `${pollsPath}${pollRoutes.active}`,
  results: (pollId: string) => `${pollsPath}${pollRoutes.results.replace(":pollId", encodeURIComponent(pollId))}`,
  votes: (pollId: string) => `${pollsPath}${pollRoutes.votes.replace(":pollId", encodeURIComponent(pollId))}`,
} as const;
