import fs from "node:fs/promises";
import path from "node:path";

type NamedAPIResource = {
  name: string;
  url: string;
};

type PokemonSummaryResponse = {
  results: NamedAPIResource[];
};

type PokemonResponse = {
  id: number;
  name: string;
  types: { slot: number; type: NamedAPIResource }[];
  species: NamedAPIResource;
};

type SpeciesResponse = {
  generation: NamedAPIResource;
};

type OutputPokemon = {
  id: number;
  name: string;
  types: string[];
  generation: number;
  isAltForm: boolean;
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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function main() {
  const list = await fetchJson<PokemonSummaryResponse>(`${API_BASE}/pokemon?limit=1500`);
  const speciesGenerationCache = new Map<string, number>();
  const baseTypingCache = new Map<string, string>();
  const output: OutputPokemon[] = [];

  for (const summary of list.results) {
    if (shouldSkipCosmetic(summary.name)) {
      continue;
    }

    const pokemon = await fetchJson<PokemonResponse>(`${API_BASE}/pokemon/${summary.name}`);
    const speciesName = pokemon.species.name;
    if (!speciesGenerationCache.has(speciesName)) {
      const species = await fetchJson<SpeciesResponse>(`${API_BASE}/pokemon-species/${speciesName}`);
      const generationNumber =
        GENERATION_MAP[species.generation.name as keyof typeof GENERATION_MAP] ?? 1;
      speciesGenerationCache.set(speciesName, generationNumber);
    }

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

    output.push({
      id: pokemon.id,
      name: normalizeFormName(pokemon.name, speciesName),
      types: sortedTypes,
      generation: speciesGenerationCache.get(speciesName) ?? 1,
      isAltForm: !isDefault,
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
