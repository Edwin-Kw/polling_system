import type { OptionResult as Result } from "@polling/shared";

export function OptionResult({ option, selected }: {
  option: Result & { percentage: number };
  selected: boolean;
}) {
  return (
    <li className="space-y-2">
      <div className="flex items-start justify-between gap-4 text-sm">
        <span className="font-medium">{option.label}{selected && <span className="text-muted-foreground"> (your choice)</span>}</span>
        <span className="shrink-0 tabular-nums">{option.count} {option.count === 1 ? "vote" : "votes"} · {option.percentage.toFixed(1)}%</span>
      </div>
      <progress aria-label={`${option.label} vote share`} value={option.percentage} max={100}
        className="h-2 w-full overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
    </li>
  );
}
