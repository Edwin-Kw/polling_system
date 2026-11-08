import type { PollOption } from "@polling/shared";
import { Button } from "./ui/button.tsx";

export interface PollVotingFormProps {
  options: PollOption[];
  selected: string | null;
  disabled: boolean;
  submitting: boolean;
  recorded: boolean;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
}

export function PollVotingForm({
  options, selected, disabled, submitting, recorded, onSelect, onSubmit,
}: PollVotingFormProps) {
  return (
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="mb-3 text-sm text-muted-foreground">Choose one answer</legend>
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 has-checked:border-primary has-checked:bg-accent has-disabled:cursor-default has-disabled:opacity-70">
            <input type="radio" name="poll-option" value={option.id} checked={selected === option.id}
              onChange={() => onSelect(option.id)}
              className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" />
            <span className="text-sm font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" className="w-full" disabled={disabled || selected === null}>
        {submitting ? "Saving vote..." : recorded ? "Vote recorded" : "Submit vote"}
      </Button>
    </form>
  );
}
