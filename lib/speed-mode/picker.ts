import {
  generateConstraint,
  validateAgainstConstraint,
  type Constraint,
} from "@/lib/constraints";
import type { ConstraintCategory, PokemonEntry, TypeCombo } from "@/lib/types";
import { normalizeCombo } from "@/lib/pokemon-utils";

import { SOLO_GENERATIONS } from "./constants";

const ENABLED_CATEGORIES: ConstraintCategory[] = [
  "REGION",
  "EVOLUTION",
  "MOVE",
  "STAT",
  "CATEGORY",
  "COMBINED",
];

const MIN_POOL_SIZE = 3;

export type RoundPick = {
  combo: TypeCombo;
  constraint: Constraint | null;
};

export class RoundPicker {
  private readonly pool: PokemonEntry[];
  private readonly comboPool: TypeCombo[];
  private usedCombos = new Set<string>();
  private lastCategory: ConstraintCategory | null = null;
  // We avoid repeating Pokémon within a run while the unused set is large
  // enough to keep things interesting. If it shrinks too far we reshuffle —
  // see picker comments below for why.
  private usedPokemonIds = new Set<number>();

  constructor(pool: PokemonEntry[]) {
    this.pool = pool;
    const dualPool = pool.filter((pokemon) => pokemon.types.length === 2);
    const seen = new Set<string>();
    const combos: TypeCombo[] = [];
    for (const pokemon of dualPool) {
      const key = normalizeCombo([pokemon.types[0], pokemon.types[1]]);
      if (seen.has(key)) continue;
      seen.add(key);
      combos.push([pokemon.types[0], pokemon.types[1]]);
    }
    this.comboPool = combos;
  }

  /**
   * Pick the next round. Reuses the multiplayer constraint generator so
   * difficulty distribution stays consistent across modes.
   */
  next(): RoundPick {
    if (this.comboPool.length === 0) {
      throw new Error("No dual-type combos available for the active settings.");
    }

    if (this.usedCombos.size >= this.comboPool.length) {
      // Combo pool exhausted: allow repeats. Speed runs are short so this
      // only happens in extreme edge cases (e.g. first-gen-only).
      this.usedCombos.clear();
    }

    let combo: TypeCombo;
    let attempts = 0;
    do {
      const candidate = this.comboPool[Math.floor(Math.random() * this.comboPool.length)];
      combo = candidate;
      attempts += 1;
      if (attempts > 50) break;
    } while (this.usedCombos.has(normalizeCombo(combo)));
    this.usedCombos.add(normalizeCombo(combo));

    const constraint = generateConstraint({
      combo,
      pool: this.pool,
      enabledCategories: ENABLED_CATEGORIES,
      generations: SOLO_GENERATIONS,
      lastCategory: this.lastCategory,
    });
    if (constraint) {
      this.lastCategory = constraint.category;
    }

    // Ensure a valid Pokémon actually exists for this combo+constraint with
    // at least MIN_POOL_SIZE candidates we haven't used yet. The constraint
    // generator already guards pool size, but we double-check against the
    // used-id set so the player isn't guaranteed a single forced answer.
    const remaining = this.pool.filter(
      (pokemon) =>
        pokemon.types.length === 2 &&
        normalizeCombo([pokemon.types[0], pokemon.types[1]]) === normalizeCombo(combo) &&
        validateAgainstConstraint(pokemon, constraint) &&
        !this.usedPokemonIds.has(pokemon.id),
    );
    if (remaining.length < MIN_POOL_SIZE) {
      // Pokémon pool exhausted for this round shape — reshuffle by clearing
      // the used set and allowing repeats. This is the documented fallback
      // behavior; in practice with 9-gen pool it almost never triggers.
      this.usedPokemonIds.clear();
    }

    return { combo, constraint };
  }

  /**
   * Mark a Pokémon as used so the picker can prefer fresh ones next round.
   */
  markPokemonUsed(id: number) {
    this.usedPokemonIds.add(id);
  }
}
