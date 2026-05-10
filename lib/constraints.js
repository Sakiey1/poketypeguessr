/**
 * Round constraint system for PoketypeGuessr.
 *
 * Generates "type + extra rule" rounds that force players off their go-to
 * answers. All logic lives in plain JS so it can be required from server.js
 * (CommonJS) without a build step.
 */

const ALL_CATEGORIES = [
  "REGION",
  "EVOLUTION",
  "MOVE",
  "STAT",
  "CATEGORY",
  "COMBINED",
];

const REGION_BY_GENERATION = {
  1: "Kanto",
  2: "Johto",
  3: "Hoenn",
  4: "Sinnoh",
  5: "Unova",
  6: "Kalos",
  7: "Alola",
  8: "Galar",
  9: "Paldea",
};

const STAT_KEYS = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"];
const STAT_LABEL = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  specialAttack: "Sp. Atk",
  specialDefense: "Sp. Def",
  speed: "Speed",
};

const KNOWN_MOVES = [
  { key: "thunderbolt", label: "Thunderbolt", type: "Electric" },
  { key: "ice-beam", label: "Ice Beam", type: "Ice" },
  { key: "earthquake", label: "Earthquake", type: "Ground" },
  { key: "flamethrower", label: "Flamethrower", type: "Fire" },
  { key: "surf", label: "Surf", type: "Water" },
  { key: "stone-edge", label: "Stone Edge", type: "Rock" },
  { key: "psychic", label: "Psychic", type: "Psychic" },
  { key: "shadow-ball", label: "Shadow Ball", type: "Ghost" },
];

const POKEMON_TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
];

const MIN_POOL_SIZE = 3;

const pickRandom = (array) => array[Math.floor(Math.random() * array.length)];

const sample = (array, count) => {
  const copy = [...array];
  const out = [];
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    out.push(copy[index]);
    copy.splice(index, 1);
  }
  return out;
};

const normalizeCombo = (combo) => [...combo].sort().join("|");

const matchesCombo = (pokemon, combo) =>
  pokemon.types.length === 2 &&
  normalizeCombo([pokemon.types[0], pokemon.types[1]]) === normalizeCombo(combo);

const passesPredicate = (pokemon, predicate) => {
  switch (predicate.kind) {
    case "generation_in":
      return predicate.generations.includes(pokemon.generation);
    case "generation_not_in":
      return !predicate.generations.includes(pokemon.generation);
    case "regional_variant_form":
      return Boolean(
        pokemon.isAltForm && pokemon.name.toLowerCase().includes(predicate.token),
      );
    case "evolution_stage_in":
      return predicate.stages.includes(pokemon.evolutionStage);
    case "knows_move":
      return Boolean(pokemon.knownMoves && pokemon.knownMoves[predicate.move]);
    case "knows_move_of_type":
      return Array.isArray(pokemon.moveTypes) && pokemon.moveTypes.includes(predicate.type);
    case "no_move_of_type":
      return Array.isArray(pokemon.moveTypes) && !pokemon.moveTypes.includes(predicate.type);
    case "bst_min":
      return typeof pokemon.bst === "number" && pokemon.bst >= predicate.min;
    case "bst_max":
      return typeof pokemon.bst === "number" && pokemon.bst <= predicate.max;
    case "highest_stat":
      return isHighestStat(pokemon, predicate.stat);
    case "lowest_stat":
      return isLowestStat(pokemon, predicate.stat);
    case "flag_true":
      return Boolean(pokemon.flags && pokemon.flags[predicate.flag]);
    case "flag_false":
      return Boolean(pokemon.flags && !pokemon.flags[predicate.flag]);
    case "not_legendary_or_mythical":
      return Boolean(
        pokemon.flags && !pokemon.flags.isLegendary && !pokemon.flags.isMythical,
      );
    case "is_starter_line":
      return Boolean(pokemon.flags && pokemon.flags.isStarter);
    case "not_starter_line":
      return Boolean(pokemon.flags && !pokemon.flags.isStarter);
    default:
      return true;
  }
};

const isHighestStat = (pokemon, statKey) => {
  if (!pokemon.baseStats) {
    return false;
  }
  const target = pokemon.baseStats[statKey];
  if (target == null) {
    return false;
  }
  for (const key of STAT_KEYS) {
    if (key === statKey) continue;
    if (pokemon.baseStats[key] > target) {
      return false;
    }
  }
  return true;
};

const isLowestStat = (pokemon, statKey) => {
  if (!pokemon.baseStats) {
    return false;
  }
  const target = pokemon.baseStats[statKey];
  if (target == null) {
    return false;
  }
  for (const key of STAT_KEYS) {
    if (key === statKey) continue;
    if (pokemon.baseStats[key] < target) {
      return false;
    }
  }
  return true;
};

const passesAllPredicates = (pokemon, predicates) => {
  for (const predicate of predicates) {
    if (!passesPredicate(pokemon, predicate)) {
      return false;
    }
  }
  return true;
};

const countMatching = (pool, combo, predicates) => {
  let count = 0;
  for (const pokemon of pool) {
    if (!matchesCombo(pokemon, combo)) continue;
    if (!passesAllPredicates(pokemon, predicates)) continue;
    count += 1;
  }
  return count;
};

const buildConstraint = (category, text, description, predicates, difficulty) => ({
  category,
  text,
  description,
  predicates,
  difficulty,
});

const regionConstraintCandidates = (combo, generations) => {
  const candidates = [];
  const enabledRegions = generations
    .map((generation) => ({ generation, region: REGION_BY_GENERATION[generation] }))
    .filter((entry) => entry.region);

  for (const { generation, region } of enabledRegions) {
    candidates.push(
      buildConstraint(
        "REGION",
        `${region} only`,
        `Pokemon must originate from generation ${generation} (${region}).`,
        [{ kind: "generation_in", generations: [generation] }],
        "medium",
      ),
    );
  }

  if (enabledRegions.length >= 2) {
    const pair = sample(enabledRegions, 2);
    const text = `${pair[0].region} or ${pair[1].region} only`;
    candidates.push(
      buildConstraint(
        "REGION",
        text,
        `Pokemon must originate from ${pair[0].region} or ${pair[1].region}.`,
        [{ kind: "generation_in", generations: pair.map((p) => p.generation) }],
        "easy",
      ),
    );
  }

  if (enabledRegions.length >= 2) {
    const excluded = pickRandom(enabledRegions);
    candidates.push(
      buildConstraint(
        "REGION",
        `Anything except ${excluded.region}`,
        `Pokemon must NOT be from generation ${excluded.generation} (${excluded.region}).`,
        [{ kind: "generation_not_in", generations: [excluded.generation] }],
        "easy",
      ),
    );
  }

  return candidates;
};

const evolutionConstraintCandidates = () => [
  buildConstraint(
    "EVOLUTION",
    "First stage of an evolution line",
    "Pokemon must be the unevolved base form of a multi-stage line.",
    [{ kind: "evolution_stage_in", stages: ["first"] }],
    "medium",
  ),
  buildConstraint(
    "EVOLUTION",
    "Final stage of an evolution line",
    "Pokemon must be the fully evolved form of a multi-stage line.",
    [{ kind: "evolution_stage_in", stages: ["final"] }],
    "easy",
  ),
  buildConstraint(
    "EVOLUTION",
    "Middle stage only",
    "Pokemon must be a middle-stage evolution (e.g., Dragonair, Kadabra).",
    [{ kind: "evolution_stage_in", stages: ["middle"] }],
    "hard",
  ),
  buildConstraint(
    "EVOLUTION",
    "No evolution line (single-stage only)",
    "Pokemon must not evolve and must not have evolved (e.g., Tauros, Lapras).",
    [{ kind: "evolution_stage_in", stages: ["single"] }],
    "hard",
  ),
];

const moveConstraintCandidates = () => {
  const out = [];
  for (const move of KNOWN_MOVES) {
    out.push(
      buildConstraint(
        "MOVE",
        `Can learn ${move.label}`,
        `Pokemon must be able to learn ${move.label} via TM, level-up, or tutor.`,
        [{ kind: "knows_move", move: move.key }],
        "medium",
      ),
    );
  }
  for (const type of POKEMON_TYPES) {
    out.push(
      buildConstraint(
        "MOVE",
        `Can learn a ${type}-type move`,
        `Pokemon must learn at least one ${type}-type move.`,
        [{ kind: "knows_move_of_type", type }],
        "medium",
      ),
    );
    out.push(
      buildConstraint(
        "MOVE",
        `CANNOT learn any ${type}-type move`,
        `Pokemon must NOT have any ${type}-type moves in its learnset.`,
        [{ kind: "no_move_of_type", type }],
        "hard",
      ),
    );
  }
  return out;
};

const statConstraintCandidates = () => {
  const out = [
    buildConstraint(
      "STAT",
      "BST under 400",
      "Base stat total must be 399 or less.",
      [{ kind: "bst_max", max: 399 }],
      "hard",
    ),
    buildConstraint(
      "STAT",
      "BST under 450",
      "Base stat total must be 449 or less.",
      [{ kind: "bst_max", max: 449 }],
      "medium",
    ),
    buildConstraint(
      "STAT",
      "BST over 550",
      "Base stat total must be 551 or more.",
      [{ kind: "bst_min", min: 551 }],
      "easy",
    ),
    buildConstraint(
      "STAT",
      "BST over 600",
      "Base stat total must be 601 or more.",
      [{ kind: "bst_min", min: 601 }],
      "medium",
    ),
  ];
  for (const stat of STAT_KEYS) {
    out.push(
      buildConstraint(
        "STAT",
        `Highest base stat is ${STAT_LABEL[stat]}`,
        `${STAT_LABEL[stat]} must be the Pokemon's highest base stat.`,
        [{ kind: "highest_stat", stat }],
        "hard",
      ),
    );
    out.push(
      buildConstraint(
        "STAT",
        `Lowest base stat is ${STAT_LABEL[stat]}`,
        `${STAT_LABEL[stat]} must be the Pokemon's lowest base stat.`,
        [{ kind: "lowest_stat", stat }],
        "hard",
      ),
    );
  }
  return out;
};

const categoryConstraintCandidates = () => [
  buildConstraint(
    "CATEGORY",
    "Starters only",
    "Pokemon must be in a starter evolution line.",
    [{ kind: "is_starter_line" }],
    "medium",
  ),
  buildConstraint(
    "CATEGORY",
    "Pseudo-legendaries only",
    "Pokemon must be in a pseudo-legendary line (Dragonite, Tyranitar, etc.).",
    [{ kind: "flag_true", flag: "isPseudoLegendary" }],
    "hard",
  ),
  buildConstraint(
    "CATEGORY",
    "Fossil Pokemon only",
    "Pokemon must be in a fossil line.",
    [{ kind: "flag_true", flag: "isFossil" }],
    "hard",
  ),
  buildConstraint(
    "CATEGORY",
    "Baby Pokemon only",
    "Pokemon must be a baby Pokemon (Pichu, Cleffa, etc.).",
    [{ kind: "flag_true", flag: "isBaby" }],
    "hard",
  ),
  buildConstraint(
    "CATEGORY",
    "Has a regional variant",
    "Species must have an Alolan, Galarian, Hisuian, or Paldean form.",
    [{ kind: "flag_true", flag: "hasRegionalVariant" }],
    "medium",
  ),
  buildConstraint(
    "CATEGORY",
    "Legendaries / Mythicals excluded",
    "Pokemon must not be a legendary or mythical.",
    [{ kind: "not_legendary_or_mythical" }],
    "easy",
  ),
];

const combinedConstraintCandidates = (combo, generations) => {
  const out = [];
  const regions = generations
    .map((generation) => ({ generation, region: REGION_BY_GENERATION[generation] }))
    .filter((entry) => entry.region);

  for (const { generation, region } of regions) {
    out.push(
      buildConstraint(
        "COMBINED",
        `${region} only AND first stage`,
        `Pokemon must be from ${region} AND be the first stage of a multi-stage line.`,
        [
          { kind: "generation_in", generations: [generation] },
          { kind: "evolution_stage_in", stages: ["first"] },
        ],
        "hard",
      ),
    );
    out.push(
      buildConstraint(
        "COMBINED",
        `${region} only AND final stage`,
        `Pokemon must be from ${region} AND be the final stage of an evolution line.`,
        [
          { kind: "generation_in", generations: [generation] },
          { kind: "evolution_stage_in", stages: ["final"] },
        ],
        "medium",
      ),
    );
  }

  out.push(
    buildConstraint(
      "COMBINED",
      "BST under 450 AND first stage",
      "BST 449 or less AND first stage of a multi-stage line.",
      [
        { kind: "bst_max", max: 449 },
        { kind: "evolution_stage_in", stages: ["first"] },
      ],
      "medium",
    ),
  );
  out.push(
    buildConstraint(
      "COMBINED",
      "Final stage AND can learn Earthquake",
      "Final stage of evolution AND learns Earthquake.",
      [
        { kind: "evolution_stage_in", stages: ["final"] },
        { kind: "knows_move", move: "earthquake" },
      ],
      "medium",
    ),
  );
  out.push(
    buildConstraint(
      "COMBINED",
      "Final stage AND can learn Ice Beam",
      "Final stage of evolution AND learns Ice Beam.",
      [
        { kind: "evolution_stage_in", stages: ["final"] },
        { kind: "knows_move", move: "ice-beam" },
      ],
      "medium",
    ),
  );
  out.push(
    buildConstraint(
      "COMBINED",
      "BST over 550 AND non-legendary",
      "BST 551 or more AND not a legendary or mythical.",
      [
        { kind: "bst_min", min: 551 },
        { kind: "not_legendary_or_mythical" },
      ],
      "medium",
    ),
  );
  out.push(
    buildConstraint(
      "COMBINED",
      "First stage AND non-starter",
      "First stage of evolution AND NOT in a starter line.",
      [
        { kind: "evolution_stage_in", stages: ["first"] },
        { kind: "not_starter_line" },
      ],
      "easy",
    ),
  );

  return out;
};

const candidatesByCategory = (combo, generations) => ({
  REGION: regionConstraintCandidates(combo, generations),
  EVOLUTION: evolutionConstraintCandidates(),
  MOVE: moveConstraintCandidates(),
  STAT: statConstraintCandidates(),
  CATEGORY: categoryConstraintCandidates(),
  COMBINED: combinedConstraintCandidates(combo, generations),
});

/**
 * Decide which constraint to apply (if any) for the given combo and the
 * lobby's enabled categories. Returns `null` to mean "Standard round".
 *
 * A candidate is accepted only if it both
 *   (a) leaves at least MIN_POOL_SIZE Pokemon valid (so the round is fair), and
 *   (b) actually excludes at least one Pokemon from the combo (so the rule
 *       isn't a no-op like "Bug/Flying that is NOT a starter" when no Bug/Flying
 *       starters exist).
 */
const generateConstraint = ({
  combo,
  pool,
  enabledCategories,
  generations,
  lastCategory = null,
  standardChance = 0.3,
}) => {
  const enabled = enabledCategories.filter((category) => ALL_CATEGORIES.includes(category));
  if (enabled.length === 0) {
    return null;
  }
  if (Math.random() < standardChance) {
    return null;
  }

  const rotated = enabled.filter((category) => category !== lastCategory);
  const orderedCategories = rotated.length > 0 ? rotated : enabled;
  const shuffledCategories = sample(orderedCategories, orderedCategories.length);

  const buckets = candidatesByCategory(combo, generations);
  const totalForCombo = pool.reduce(
    (count, pokemon) => (matchesCombo(pokemon, combo) ? count + 1 : count),
    0,
  );

  for (const category of shuffledCategories) {
    const candidates = sample(buckets[category] ?? [], (buckets[category] ?? []).length);
    for (const candidate of candidates) {
      const filtered = countMatching(pool, combo, candidate.predicates);
      if (filtered < MIN_POOL_SIZE) continue;
      if (filtered >= totalForCombo) continue;
      if (!everyPredicateContributes(pool, combo, candidate.predicates, filtered)) continue;
      return candidate;
    }
  }
  return null;
};

const everyPredicateContributes = (pool, combo, predicates, baselineCount) => {
  if (predicates.length <= 1) {
    return true;
  }
  for (let i = 0; i < predicates.length; i += 1) {
    const without = predicates.filter((_, index) => index !== i);
    if (countMatching(pool, combo, without) === baselineCount) {
      return false;
    }
  }
  return true;
};

/**
 * Given a constraint object (or null) plus the player's chosen Pokemon, return
 * `true` if it satisfies the constraint.
 */
const validateAgainstConstraint = (pokemon, constraint) => {
  if (!constraint) {
    return true;
  }
  return passesAllPredicates(pokemon, constraint.predicates);
};

/**
 * Count the matching Pokemon in `pool` for a combo + constraint. Used by the
 * server to discard rounds that would be unfair.
 */
const countConstraintMatches = (pool, combo, constraint) => {
  if (!constraint) {
    return pool.filter((pokemon) => matchesCombo(pokemon, combo)).length;
  }
  return countMatching(pool, combo, constraint.predicates);
};

const renderConstraintForClient = (constraint) =>
  constraint
    ? {
        category: constraint.category,
        text: constraint.text,
        description: constraint.description,
        difficulty: constraint.difficulty,
      }
    : null;

module.exports = {
  ALL_CATEGORIES,
  MIN_POOL_SIZE,
  REGION_BY_GENERATION,
  generateConstraint,
  validateAgainstConstraint,
  countConstraintMatches,
  renderConstraintForClient,
};
