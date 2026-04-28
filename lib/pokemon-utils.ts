import pokemonData from "@/data/pokemon.json";
import type { LobbySettings, PokemonEntry, PokemonType, TypeCombo } from "@/lib/types";

const allPokemon = pokemonData as unknown as PokemonEntry[];

export const normalizeCombo = (types: [string, string]) =>
  [...types].sort().join("|");

export const getAllPokemon = () => allPokemon;

export const getDualTypePokemon = (settings: LobbySettings) =>
  allPokemon.filter(
    (pokemon) =>
      pokemon.types.length === 2 &&
      settings.generations.includes(pokemon.generation) &&
      (settings.includeAltForms || !pokemon.isAltForm),
  );

export const getValidComboPool = (settings: LobbySettings): TypeCombo[] => {
  const comboKeys = new Set<string>();
  for (const pokemon of getDualTypePokemon(settings)) {
    comboKeys.add(normalizeCombo([pokemon.types[0], pokemon.types[1]]));
  }

  return [...comboKeys].map((key) => {
    const [a, b] = key.split("|") as [PokemonType, PokemonType];
    return [a, b];
  });
};

export const pokemonMatchesCombo = (pokemon: PokemonEntry, combo: TypeCombo) =>
  pokemon.types.length === 2 &&
  normalizeCombo([pokemon.types[0], pokemon.types[1]]) ===
    normalizeCombo([combo[0], combo[1]]);

export const validatePokemonSelection = (
  pokemon: PokemonEntry | undefined,
  combo: TypeCombo,
  settings: LobbySettings,
) => {
  if (!pokemon) {
    return false;
  }

  if (pokemon.types.length !== 2) {
    return false;
  }

  if (!settings.generations.includes(pokemon.generation)) {
    return false;
  }

  if (!settings.includeAltForms && pokemon.isAltForm) {
    return false;
  }

  return pokemonMatchesCombo(pokemon, combo);
};

export const getExampleAnswer = (combo: TypeCombo, settings: LobbySettings) =>
  getDualTypePokemon(settings).find((pokemon) => pokemonMatchesCombo(pokemon, combo));

export const searchPokemon = (query: string, settings: LobbySettings) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return allPokemon.filter(
    (pokemon) =>
      pokemon.name.toLowerCase().includes(normalized) &&
      settings.generations.includes(pokemon.generation) &&
      (settings.includeAltForms || !pokemon.isAltForm),
  );
};
