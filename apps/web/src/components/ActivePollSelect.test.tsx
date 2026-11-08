import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { poll, secondPoll } from "../test/poll.ts";
import { ActivePollSelect } from "./ActivePollSelect.tsx";

describe("styled active poll selector", () => {
  it("marks the selected poll, supports keyboard switching, and returns focus on Escape", async () => {
    const onChange = vi.fn();
    render(<ActivePollSelect polls={[poll, secondPoll]} value={poll.id} disabled={false}
      loading={false} voteInProgress={false} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Switch active poll" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(await screen.findByRole("option", { name: poll.question })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(secondPoll.id);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps the control disabled and explains why while reconciling a vote", async () => {
    const onChange = vi.fn();
    render(<ActivePollSelect polls={[poll, secondPoll]} value={poll.id} disabled
      loading={false} voteInProgress onChange={onChange} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAccessibleDescription("Finish saving or checking your vote before switching polls.");
    await userEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    { loading: true, message: "Loading polls..." },
    { loading: false, message: "No active polls" },
  ])("shows $message without invented menu items", ({ loading, message }) => {
    render(<ActivePollSelect polls={[]} value="" disabled loading={loading}
      voteInProgress={false} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent(message);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
