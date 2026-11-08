import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deriveResults } from "@polling/shared";
import { poll, results } from "../test/poll.ts";
import { PollResults } from "./PollResults.tsx";

describe("live result connection announcements", () => {
  it("announces a real connected status without exposing implementation commentary", () => {
    render(<PollResults question={poll.question} results={deriveResults(results)} selected={null}
      pending={false} warning={null} connection="connected" />);
    expect(screen.getByRole("status")).toHaveTextContent("Live updates connected.");
    expect(screen.queryByText(/Socket.IO|setup|agent|every 2 seconds/)).not.toBeInTheDocument();
  });
  it("retains confirmed counts and explicitly announces the disconnected polling fallback", () => {
    render(<PollResults question={poll.question} results={deriveResults(results)} selected={null}
      pending={false} warning={null} connection="disconnected" />);
    expect(screen.getByRole("status")).toHaveTextContent("Live updates disconnected.");
    expect(screen.getByRole("status")).toHaveTextContent("every 2 seconds");
    expect(screen.getByText("4 votes")).toBeVisible();
  });
  it("does not claim healthy live updating when the result snapshot is unavailable", () => {
    render(<PollResults question={poll.question} results={deriveResults(results)} selected={null}
      pending={false} warning="Results couldn't refresh." connection="connected" />);
    expect(screen.getByText("Updates delayed")).toBeVisible();
    expect(screen.queryByText("Live updating")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't refresh");
    expect(screen.getByText("4 votes")).toBeVisible();
  });
});
