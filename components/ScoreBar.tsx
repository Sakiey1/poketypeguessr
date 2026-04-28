import clsx from "clsx";

type ScoreBarProps = {
  label: string;
  score: number;
  targetScore: number;
  highlighted?: boolean;
};

export function ScoreBar({ label, score, targetScore, highlighted = false }: ScoreBarProps) {
  const pips = Array.from({ length: targetScore }, (_, index) => index < score);

  return (
    <div
      className={clsx(
        "w-full border-4 border-black bg-white p-3 font-pixel",
        highlighted && "bg-[#f7f4e7]",
      )}
    >
      <div className="text-sm uppercase">{label}</div>
      <div className="flex items-center justify-between gap-3 mt-1">
        <div className="flex flex-wrap gap-1">
          {pips.map((filled, index) => (
            <span
              key={`${label}-${index}`}
              className={clsx(
                "inline-block h-3 w-4 border border-black",
                filled ? "bg-[#78c850]" : "bg-transparent",
              )}
            />
          ))}
        </div>
        <div className="font-press text-xs">
          {score}/{targetScore}
        </div>
      </div>
    </div>
  );
}
