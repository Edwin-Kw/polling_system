import { ListFilter } from "lucide-react";
import type { Poll } from "@polling/shared";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "./ui/select.tsx";

interface ActivePollSelectProps {
  polls: Poll[];
  value: string;
  disabled: boolean;
  loading: boolean;
  voteInProgress: boolean;
  onChange: (pollId: string) => void;
}

export function ActivePollSelect({
  polls, value, disabled, loading, voteInProgress, onChange,
}: ActivePollSelectProps) {
  return (
    <div className="space-y-3">
      <label htmlFor="active-poll-select" className="block text-base font-semibold">Switch active poll</label>
      <Select value={value} onValueChange={onChange} disabled={disabled || polls.length === 0}>
        <SelectTrigger id="active-poll-select" aria-describedby={voteInProgress ? "poll-switch-help" : undefined}
          className="group w-full min-w-0 gap-3 rounded-xl bg-card px-4 py-4 text-left text-base shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/30 data-[size=default]:h-auto data-[state=open]:border-primary data-[state=open]:ring-3 data-[state=open]:ring-ring/15 *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:line-clamp-none [&>svg]:text-primary [&>svg]:opacity-100 [&>svg]:transition-transform [&>svg]:group-data-[state=open]:rotate-180">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <ListFilter className="size-4 text-primary" />
          </span>
          <SelectValue placeholder={loading ? "Loading polls..." : "No active polls"} />
        </SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={6}
          className="w-(--radix-select-trigger-width) rounded-xl border-border bg-card p-1 shadow-xl shadow-foreground/10">
          <SelectGroup>
            <SelectLabel className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground">
              Choose an active poll
            </SelectLabel>
            {polls.map((poll) => (
              <SelectItem key={poll.id} value={poll.id}
                className="min-h-12 cursor-pointer rounded-lg py-3 pr-10 pl-3 text-sm leading-relaxed focus:bg-accent focus:text-foreground data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-primary [&_[data-slot=select-item-indicator]]:right-3 [&_svg]:text-primary">
                <span className="min-w-0 whitespace-normal break-words">{poll.question}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {voteInProgress && (
        <p id="poll-switch-help" className="text-sm text-muted-foreground">
          Finish saving or checking your vote before switching polls.
        </p>
      )}
    </div>
  );
}
