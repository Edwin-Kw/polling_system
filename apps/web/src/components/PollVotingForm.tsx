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
    <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <fieldset disabled={disabled} className="space-y-3">
        <legend className="sr-only">Choose one answer</legend>
        {options.map((option) => (
          <label key={option.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-input px-4 py-3 transition-colors has-checked:border-primary has-checked:bg-accent has-disabled:cursor-default has-disabled:opacity-70">
            <input type="radio" name="poll-option" value={option.id} checked={selected === option.id}
              onChange={() => onSelect(option.id)}
              className="size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" />
            <span className="text-base font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold shadow-sm" disabled={disabled || selected === null}>
        {submitting ? "Saving vote..." : recorded ? "Vote recorded" : "Cast Your Vote"}
      </Button>
    </form>
  );
}
