"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import type { PokemonEntry, TypeCombo } from "@/lib/types";
import { TYPE_COLORS } from "@/lib/type-colors";

type PokemonSearchDropdownProps = {
  allPokemon: PokemonEntry[];
  combo: TypeCombo;
  disabled?: boolean;
  onSubmit: (pokemonId: number) => void;
};

const MAX_ROWS = 8;

export function PokemonSearchDropdown({
  allPokemon,
  combo,
  disabled = false,
  onSubmit,
}: PokemonSearchDropdownProps) {
  const [query, setQuery] = useState("");
  const primaryColor = TYPE_COLORS[combo[0]];

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return allPokemon
      .filter((pokemon) => pokemon.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 200);
  }, [allPokemon, query]);

  const clearInput = () => setQuery("");

  const submitTopMatch = () => {
    const topMatch = rows[0];
    if (!topMatch || disabled) {
      return;
    }
    onSubmit(topMatch.id);
    setQuery("");
  };

  return (
    <div className="w-full max-w-2xl border-4 border-black bg-[#f7f4e7]">
      <div className="flex items-center border-b-4 border-black px-4 py-3 gap-3">
        <span className="text-2xl">🔍</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitTopMatch();
            }
          }}
          disabled={disabled}
          placeholder={disabled ? "Waiting..." : "Search Pokemon..."}
          className="w-full bg-transparent font-pixel text-2xl outline-none"
        />
        <button
          type="button"
          onClick={clearInput}
          disabled={!query}
          className="border-2 border-black px-3 py-1 text-sm font-press disabled:opacity-40"
        >
          X
        </button>
      </div>

      {query && (
        <ul className="max-h-[420px] overflow-y-auto">
          {rows.length === 0 ? (
            <li className="px-4 py-4 font-pixel text-xl">No matches</li>
          ) : (
            rows.slice(0, MAX_ROWS).map((pokemon) => (
              <li key={pokemon.id} className="border-b border-black flex items-center justify-between gap-3 px-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`}
                    alt={pokemon.name}
                    width={56}
                    height={56}
                    className="pixel-img"
                    unoptimized
                  />
                  <span className="font-pixel text-2xl truncate">{pokemon.name}</span>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSubmit(pokemon.id);
                    setQuery("");
                  }}
                  className="font-press text-sm border-2 border-black px-3 py-2 text-white disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
                  style={{ backgroundColor: primaryColor }}
                >
                  Select
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
