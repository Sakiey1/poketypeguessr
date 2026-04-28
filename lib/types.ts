export const POKEMON_TYPES = [
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
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

export type TypeCombo = [PokemonType, PokemonType];

export type PokemonEntry = {
  id: number;
  name: string;
  types: PokemonType[];
  generation: number;
  isAltForm: boolean;
};

export type LobbySettings = {
  targetScore: number;
  generations: number[];
  includeAltForms: boolean;
};

export type PlayerState = {
  id: string;
  name: string;
  score: number;
  connected: boolean;
};

export type RoomStatePayload = {
  roomCode: string;
  players: PlayerState[];
  settings: LobbySettings;
  isHost: boolean;
  hostId: string;
  gameStarted: boolean;
};
