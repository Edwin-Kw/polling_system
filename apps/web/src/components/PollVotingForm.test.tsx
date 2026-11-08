import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { poll, optionId } from "../test/poll.ts";
import { PollVotingForm } from "./PollVotingForm.tsx";

describe("accessible voting form", () => {
  it("requires selection and reports keyboard selection through callbacks", async () => {
    const onSelect = vi.fn();
    render(<PollVotingForm options={poll.options} selected={null} disabled={false}
      submitting={false} recorded={false} onSelect={onSelect} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cast Your Vote" })).toBeDisabled();
    screen.getByRole("radio", { name: "Dark mode" }).focus();
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledWith(optionId);
  });
  it("disables all choices and submission while a vote is pending", () => {
    render(<PollVotingForm options={poll.options} selected={optionId} disabled
      submitting recorded={false} onSelect={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Saving vote..." })).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});
