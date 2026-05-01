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
        "w-full border-4 border-black bg-white p-4 font-pixel",
        highlighted && "bg-[#f7f4e7]",
      )}
    >
      <div className="text-xl uppercase leading-tight">{label}</div>
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="flex flex-wrap gap-1.5">
          {pips.map((filled, index) => (
            <span
              key={`${label}-${index}`}
              className={clsx(
                "inline-block h-4 w-5 border-2 border-black",
                filled ? "bg-[#78c850]" : "bg-transparent",
              )}
            />
          ))}
        </div>
        <div className="font-press text-sm">
          {score}/{targetScore}
        </div>
      </div>
    </div>
  );
}
