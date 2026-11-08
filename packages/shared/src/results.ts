import type { PollResults } from "./index.ts";

export function deriveResults(results: PollResults, overlayOption: string | null = null) {
  const overlay = results.myVote === null
    && results.options.some((option) => option.id === overlayOption) ? overlayOption : null;
  const totalVotes = results.totalVotes + (overlay ? 1 : 0);
  return {
    ...results,
    totalVotes,
    options: results.options.map((option) => {
      const count = option.count + (option.id === overlay ? 1 : 0);
      return { ...option, count, percentage: totalVotes === 0 ? 0 : count / totalVotes * 100 };
    }),
  };
}
