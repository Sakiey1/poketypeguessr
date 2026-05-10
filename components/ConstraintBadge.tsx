import type { ConstraintPayload } from "@/lib/types";

// Shared between multiplayer (app/game/[roomCode]/page.tsx) and single-player
// speed mode (app/speed/[mode]/page.tsx) so both surfaces render constraints
// identically. Pure render: no state, no behavior change vs. the prior inline
// JSX it replaces.
const DIFFICULTY_COLOR: Record<ConstraintPayload["difficulty"], string> = {
  easy: "#9bbc0f",
  medium: "#F8D030",
  hard: "#c03028",
};

type ConstraintBadgeProps = {
  constraint: ConstraintPayload | null | undefined;
};

export function ConstraintBadge({ constraint }: ConstraintBadgeProps) {
  if (!constraint) {
    return null;
  }

  const accent = DIFFICULTY_COLOR[constraint.difficulty];

  return (
    <div
      className="border-4 border-black bg-[#f7f4e7] px-4 py-3 max-w-2xl w-full flex flex-col items-center gap-2"
      style={{ boxShadow: `4px 4px 0 0 ${accent}` }}
    >
      <span
        className="font-press text-[10px] uppercase"
        style={{ color: accent }}
      >
        Constraint · {constraint.difficulty}
      </span>
      <p className="font-pixel text-2xl text-center">{constraint.text}</p>
    </div>
  );
}
