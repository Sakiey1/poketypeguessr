import fs from "node:fs/promises";
import path from "node:path";

type NamedAPIResource = {
  name: string;
  url: string;
};

type PokemonSummaryResponse = {
  results: NamedAPIResource[];
};

type StatEntry = {
  base_stat: number;
  stat: NamedAPIResource;
};

type MoveEntry = {
  move: NamedAPIResource;
};

type PokemonResponse = {
  id: number;
  name: string;
  types: { slot: number; type: NamedAPIResource }[];
  species: NamedAPIResource;
  stats: StatEntry[];
  moves: MoveEntry[];
};

type SpeciesResponse = {
  generation: NamedAPIResource;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  evolves_from_species: NamedAPIResource | null;
  evolution_chain: { url: string };
  varieties: { is_default: boolean; pokemon: NamedAPIResource }[];
};

type EvolutionChainNode = {
  species: NamedAPIResource;
  evolves_to: EvolutionChainNode[];
};

type EvolutionChainResponse = {
  id: number;
  chain: EvolutionChainNode;
};

type MoveResponse = {
  name: string;
  type: NamedAPIResource;
};

type EvolutionStage = "single" | "first" | "middle" | "final";

type OutputPokemon = {
  id: number;
  name: string;
  types: string[];
  generation: number;
  isAltForm: boolean;
  bst: number;
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  evolutionStage: EvolutionStage;
  moveTypes: string[];
  knownMoves: Record<string, boolean>;
  flags: {
    isBaby: boolean;
    isLegendary: boolean;
    isMythical: boolean;
    isStarter: boolean;
    isPseudoLegendary: boolean;
    isFossil: boolean;
    hasRegionalVariant: boolean;
  };
};

const API_BASE = "https://pokeapi.co/api/v2";

const GENERATION_MAP = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

const includedFormTokens = [
  "alola",
  "galar",
  "hisui",
  "paldea",
  "mega",
  "gmax",
  "primal",
  "totem",
  "therian",
  "origin",
  "school",
  "amped",
  "low-key",
  "wash",
  "heat",
  "frost",
  "fan",
  "mow",
  "incarnate",
  "resolute",
  "aria",
  "pirouette",
  "blade",
  "shield",
  "attack",
  "defense",
  "speed",
  "complete",
  "10",
  "50",
  "ultra",
  "eternamax",
  "busted",
  "hero",
  "crowned",
  "combat",
  "blaze",
  "aqua",
];

const cosmeticOnlyFormTokens = [
  "cosplay",
  "belle",
  "pop-star",
  "phd",
  "libre",
  "rock-star",
  "cap-",
  "starter",
  "world",
  "original",
  "hoenn",
  "sinnoh",
  "unova",
  "kalos",
  "partner",
  "rainy",
  "snowy",
  "sunny",
];

const KNOWN_MOVE_KEYS = [
  "thunderbolt",
  "ice-beam",
  "earthquake",
  "flamethrower",
  "surf",
  "stone-edge",
  "psychic",
  "shadow-ball",
] as const;

type KnownMoveKey = (typeof KNOWN_MOVE_KEYS)[number];

const STARTER_SPECIES = new Set([
  "bulbasaur",
  "ivysaur",
  "venusaur",
  "charmander",
  "charmeleon",
  "charizard",
  "squirtle",
  "wartortle",
  "blastoise",
  "chikorita",
  "bayleef",
  "meganium",
  "cyndaquil",
  "quilava",
  "typhlosion",
  "totodile",
  "croconaw",
  "feraligatr",
  "treecko",
  "grovyle",
  "sceptile",
  "torchic",
  "combusken",
  "blaziken",
  "mudkip",
  "marshtomp",
  "swampert",
  "turtwig",
  "grotle",
  "torterra",
  "chimchar",
  "monferno",
  "infernape",
  "piplup",
  "prinplup",
  "empoleon",
  "snivy",
  "servine",
  "serperior",
  "tepig",
  "pignite",
  "emboar",
  "oshawott",
  "dewott",
  "samurott",
  "chespin",
  "quilladin",
  "chesnaught",
  "fennekin",
  "braixen",
  "delphox",
  "froakie",
  "frogadier",
  "greninja",
  "rowlet",
  "dartrix",
  "decidueye",
  "litten",
  "torracat",
  "incineroar",
  "popplio",
  "brionne",
  "primarina",
  "grookey",
  "thwackey",
  "rillaboom",
  "scorbunny",
  "raboot",
  "cinderace",
  "sobble",
  "drizzile",
  "inteleon",
  "sprigatito",
  "floragato",
  "meowscarada",
  "fuecoco",
  "crocalor",
  "skeledirge",
  "quaxly",
  "quaxwell",
  "quaquaval",
]);

const PSEUDO_LEGENDARY_SPECIES = new Set([
  "dratini",
  "dragonair",
  "dragonite",
  "larvitar",
  "pupitar",
  "tyranitar",
  "bagon",
  "shelgon",
  "salamence",
  "beldum",
  "metang",
  "metagross",
  "gible",
  "gabite",
  "garchomp",
  "deino",
  "zweilous",
  "hydreigon",
  "goomy",
  "sliggoo",
  "goodra",
  "jangmo-o",
  "hakamo-o",
  "kommo-o",
  "dreepy",
  "drakloak",
  "dragapult",
  "frigibax",
  "arctibax",
  "baxcalibur",
]);

const FOSSIL_SPECIES = new Set([
  "omanyte",
  "omastar",
  "kabuto",
  "kabutops",
  "aerodactyl",
  "lileep",
  "cradily",
  "anorith",
  "armaldo",
  "cranidos",
  "rampardos",
  "shieldon",
  "bastiodon",
  "tirtouga",
  "carracosta",
  "archen",
  "archeops",
  "tyrunt",
  "tyrantrum",
  "amaura",
  "aurorus",
  "dracozolt",
  "arctozolt",
  "dracovish",
  "arctovish",
]);

const titleCase = (value: string) =>
  value
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const TYPE_FIXUPS: Record<string, string> = {
  Fire: "Fire",
};

const normalizeType = (typeName: string) => {
  const cased = titleCase(typeName);
  return TYPE_FIXUPS[cased] ?? cased;
};

const normalizeFormName = (pokemonName: string, speciesName: string) => {
  if (pokemonName === speciesName) {
    return titleCase(speciesName);
  }

  const suffixRaw = pokemonName.slice(speciesName.length + 1);
  const suffix = suffixRaw
    .split("-")
    .map((part) => part.toLowerCase())
    .join(" ");

  const readableSuffix = suffix
    .replace("alola", "Alolan")
    .replace("galar", "Galarian")
    .replace("hisui", "Hisuian")
    .replace("paldea", "Paldean")
    .replace("gmax", "Gmax")
    .replace("mega x", "Mega X")
    .replace("mega y", "Mega Y")
    .replace("mega", "Mega")
    .replace("primal", "Primal");

  return `${titleCase(speciesName)} ${readableSuffix
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ")}`.replace(/\s+/g, " ");
};

const shouldSkipCosmetic = (pokemonName: string) =>
  cosmeticOnlyFormTokens.some((token) => pokemonName.includes(token));

const shouldForceInclude = (pokemonName: string) =>
  includedFormTokens.some((token) => pokemonName.includes(token));

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      return fetchJson<T>(url, attempt + 1);
    }
    throw new Error(`Failed to fetch ${url}: ${(error as Error).message}`);
  }
}

const STAT_KEYS: Record<string, keyof OutputPokemon["baseStats"]> = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};

const buildBaseStats = (stats: StatEntry[]): OutputPokemon["baseStats"] => {
  const out: OutputPokemon["baseStats"] = {
    hp: 0,
    attack: 0,
    defense: 0,
    specialAttack: 0,
    specialDefense: 0,
    speed: 0,
  };
  for (const entry of stats) {
    const key = STAT_KEYS[entry.stat.name];
    if (key) {
      out[key] = entry.base_stat;
    }
  }
  return out;
};

const sumBst = (stats: OutputPokemon["baseStats"]) =>
  stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed;

const computeEvolutionPositions = (chain: EvolutionChainNode): Map<string, EvolutionStage> => {
  const result = new Map<string, EvolutionStage>();
  const traverse = (node: EvolutionChainNode, depth: number, isFinal: boolean) => {
    if (isFinal && depth === 0) {
      result.set(node.species.name, "single");
    } else if (depth === 0) {
      result.set(node.species.name, "first");
    } else if (isFinal) {
      result.set(node.species.name, "final");
    } else {
      result.set(node.species.name, "middle");
    }
    for (const next of node.evolves_to) {
      traverse(next, depth + 1, next.evolves_to.length === 0);
    }
  };
  const onlyOne = chain.evolves_to.length === 0;
  traverse(chain, 0, onlyOne);
  return result;
};

const concurrentMap = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const next = cursor++;
      if (next >= items.length) {
        return;
      }
      results[next] = await worker(items[next], next);
      done += 1;
      if (onProgress && done % 25 === 0) {
        onProgress(done, items.length);
      }
    }
  });
  await Promise.all(runners);
  if (onProgress) {
    onProgress(items.length, items.length);
  }
  return results;
};

async function main() {
  console.log("Fetching pokemon list...");
  const list = await fetchJson<PokemonSummaryResponse>(`${API_BASE}/pokemon?limit=1500`);
  const filtered = list.results.filter((entry) => !shouldSkipCosmetic(entry.name));
  console.log(`Fetching ${filtered.length} pokemon...`);

  const pokemonResponses = await concurrentMap(
    filtered,
    (entry) => fetchJson<PokemonResponse>(`${API_BASE}/pokemon/${entry.name}`),
    12,
    (done, total) => console.log(`  pokemon: ${done}/${total}`),
  );

  const speciesNames = Array.from(new Set(pokemonResponses.map((p) => p.species.name)));
  console.log(`Fetching ${speciesNames.length} species...`);
  const speciesResponses = await concurrentMap(
    speciesNames,
    (name) => fetchJson<SpeciesResponse>(`${API_BASE}/pokemon-species/${name}`),
    12,
    (done, total) => console.log(`  species: ${done}/${total}`),
  );
  const speciesByName = new Map<string, SpeciesResponse>();
  speciesResponses.forEach((response, index) => {
    speciesByName.set(speciesNames[index], response);
  });

  const evolutionChainUrls = Array.from(
    new Set(speciesResponses.map((s) => s.evolution_chain.url)),
  );
  console.log(`Fetching ${evolutionChainUrls.length} evolution chains...`);
  const evolutionChainResponses = await concurrentMap(
    evolutionChainUrls,
    (url) => fetchJson<EvolutionChainResponse>(url),
    12,
    (done, total) => console.log(`  chains: ${done}/${total}`),
  );
  const evolutionPositionBySpecies = new Map<string, EvolutionStage>();
  for (const chain of evolutionChainResponses) {
    const positions = computeEvolutionPositions(chain.chain);
    for (const [name, stage] of positions) {
      evolutionPositionBySpecies.set(name, stage);
    }
  }

  const allMoveNames = new Set<string>();
  for (const pokemon of pokemonResponses) {
    for (const moveEntry of pokemon.moves) {
      allMoveNames.add(moveEntry.move.name);
    }
  }
  const moveNameList = Array.from(allMoveNames);
  console.log(`Fetching ${moveNameList.length} unique moves...`);
  const moveResponses = await concurrentMap(
    moveNameList,
    (name) => fetchJson<MoveResponse>(`${API_BASE}/move/${name}`),
    16,
    (done, total) => console.log(`  moves: ${done}/${total}`),
  );
  const moveTypeByName = new Map<string, string>();
  for (const move of moveResponses) {
    moveTypeByName.set(move.name, normalizeType(move.type.name));
  }

  const speciesWithRegionalVariant = new Set<string>();
  for (const pokemon of pokemonResponses) {
    if (pokemon.name === pokemon.species.name) {
      continue;
    }
    const isRegional =
      pokemon.name.includes("alola") ||
      pokemon.name.includes("galar") ||
      pokemon.name.includes("hisui") ||
      pokemon.name.includes("paldea");
    if (isRegional) {
      speciesWithRegionalVariant.add(pokemon.species.name);
    }
  }

  const baseTypingCache = new Map<string, string>();
  const output: OutputPokemon[] = [];

  for (let index = 0; index < pokemonResponses.length; index += 1) {
    const pokemon = pokemonResponses[index];
    const speciesName = pokemon.species.name;
    const species = speciesByName.get(speciesName);
    if (!species) {
      continue;
    }
    const generationNumber =
      GENERATION_MAP[species.generation.name as keyof typeof GENERATION_MAP] ?? 1;
    const sortedTypes = pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map((entry) => normalizeType(entry.type.name));
    const typingKey = sortedTypes.join("|");
    const isDefault = pokemon.name === speciesName;
    const baseTypeKey = baseTypingCache.get(speciesName);
    if (!baseTypeKey && isDefault) {
      baseTypingCache.set(speciesName, typingKey);
    }
    const includeByTypingChange = !isDefault && baseTypeKey && baseTypeKey !== typingKey;
    const includeBySpecialForm = !isDefault && shouldForceInclude(pokemon.name);
    if (!isDefault && !includeByTypingChange && !includeBySpecialForm) {
      continue;
    }

    const baseStats = buildBaseStats(pokemon.stats);
    const bst = sumBst(baseStats);

    const evolutionStage =
      evolutionPositionBySpecies.get(speciesName) ?? ("single" as EvolutionStage);

    const moveTypeSet = new Set<string>();
    const knownMoves: Record<string, boolean> = Object.fromEntries(
      KNOWN_MOVE_KEYS.map((key) => [key, false]),
    );
    for (const moveEntry of pokemon.moves) {
      const moveName = moveEntry.move.name;
      const moveType = moveTypeByName.get(moveName);
      if (moveType) {
        moveTypeSet.add(moveType);
      }
      if ((KNOWN_MOVE_KEYS as readonly string[]).includes(moveName)) {
        knownMoves[moveName as KnownMoveKey] = true;
      }
    }

    const flags: OutputPokemon["flags"] = {
      isBaby: species.is_baby,
      isLegendary: species.is_legendary,
      isMythical: species.is_mythical,
      isStarter: STARTER_SPECIES.has(speciesName),
      isPseudoLegendary: PSEUDO_LEGENDARY_SPECIES.has(speciesName),
      isFossil: FOSSIL_SPECIES.has(speciesName),
      hasRegionalVariant: speciesWithRegionalVariant.has(speciesName),
    };

    output.push({
      id: pokemon.id,
      name: normalizeFormName(pokemon.name, speciesName),
      types: sortedTypes,
      generation: generationNumber,
      isAltForm: !isDefault,
      bst,
      baseStats,
      evolutionStage,
      moveTypes: Array.from(moveTypeSet).sort(),
      knownMoves,
      flags,
    });
  }

  output.sort((a, b) => a.id - b.id);
  const dataPath = path.join(process.cwd(), "data", "pokemon.json");
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${output.length} pokemon entries to ${dataPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
