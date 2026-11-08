import type { OptionResult as Result } from "@polling/shared";

export function OptionResult({ option, selected, tone }: {
  option: Result & { percentage: number };
  selected: boolean;
  tone: number;
}) {
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-base">
        <span className="font-medium">{option.label}{selected && <span className="text-muted-foreground"> (your choice)</span>}</span>
        <span className="shrink-0 tabular-nums">{option.count} {option.count === 1 ? "vote" : "votes"} · {option.percentage.toFixed(1)}%</span>
      </div>
      <progress aria-label={`${option.label} vote share`} value={option.percentage} max={100}
        data-tone={tone} className="poll-result-bar block h-3.5 w-full overflow-hidden rounded-full bg-result-track" />
    </li>
  );
}
