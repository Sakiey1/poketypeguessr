// TypeScript declarations for the existing CommonJS lib/constraints.js.
// The .js file stays authoritative so server.js (CommonJS) keeps working;
// this shim just gives the client/TypeScript code proper types when it
// imports the same module.

import type {
  ConstraintCategory,
  PokemonEntry,
  PokemonType,
  TypeCombo,
} from "@/lib/types";

export type ConstraintDifficulty = "easy" | "medium" | "hard";

export type Constraint = {
  category: ConstraintCategory;
  text: string;
  description: string;
  predicates: ReadonlyArray<unknown>;
  difficulty: ConstraintDifficulty;
};

export type ClientConstraint = {
  category: ConstraintCategory;
  text: string;
  description: string;
  difficulty: ConstraintDifficulty;
};

export const ALL_CATEGORIES: ConstraintCategory[];
export const MIN_POOL_SIZE: number;
export const REGION_BY_GENERATION: Record<number, string>;

export function generateConstraint(args: {
  combo: TypeCombo;
  pool: PokemonEntry[];
  enabledCategories: ConstraintCategory[];
  generations: number[];
  lastCategory?: ConstraintCategory | null;
  standardChance?: number;
}): Constraint | null;

export function validateAgainstConstraint(
  pokemon: PokemonEntry,
  constraint: Constraint | null,
): boolean;

export function countConstraintMatches(
  pool: PokemonEntry[],
  combo: TypeCombo,
  constraint: Constraint | null,
): number;

export function renderConstraintForClient(
  constraint: Constraint | null,
): ClientConstraint | null;

export type { PokemonType };
