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

export type EvolutionStage = "single" | "first" | "middle" | "final";

export type KnownMoveKey =
  | "thunderbolt"
  | "ice-beam"
  | "earthquake"
  | "flamethrower"
  | "surf"
  | "stone-edge"
  | "psychic"
  | "shadow-ball";

export type PokemonFlags = {
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  isStarter: boolean;
  isPseudoLegendary: boolean;
  isFossil: boolean;
  hasRegionalVariant: boolean;
};

export type PokemonEntry = {
  id: number;
  name: string;
  types: PokemonType[];
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
  moveTypes: PokemonType[];
  knownMoves: Record<KnownMoveKey, boolean>;
  flags: PokemonFlags;
};

export const CONSTRAINT_CATEGORIES = [
  "REGION",
  "EVOLUTION",
  "MOVE",
  "STAT",
  "CATEGORY",
  "COMBINED",
] as const;
export type ConstraintCategory = (typeof CONSTRAINT_CATEGORIES)[number];

export type ConstraintPayload = {
  category: ConstraintCategory;
  text: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
};

export type LobbySettings = {
  targetScore: number;
  generations: number[];
  includeAltForms: boolean;
  enabledConstraints: ConstraintCategory[];
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
