"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const primaryColor = TYPE_COLORS[combo[0]];
  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusInput = useCallback(() => {
    // Defer to next frame so focus is restored after any state-driven disable
    // / re-enable transitions from guess feedback.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return allPokemon
      .filter((pokemon) => pokemon.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 200);
  }, [allPokemon, query]);
  const visibleRows = rows.slice(0, MAX_ROWS);

  const clearInput = () => {
    setQuery("");
    setHighlightedIndex(0);
    focusInput();
  };

  const submitHighlightedMatch = () => {
    const highlightedMatch = visibleRows[highlightedIndex] ?? visibleRows[0];
    if (!highlightedMatch || disabled) {
      return;
    }
    onSubmit(highlightedMatch.id);
    setQuery("");
    setHighlightedIndex(0);
    focusInput();
  };

  useEffect(() => {
    if (!disabled) {
      focusInput();
    }
  }, [disabled, focusInput]);

  return (
    <div className="w-full max-w-2xl border-4 border-black bg-[#f7f4e7]">
      <div className="flex items-center border-b-4 border-black px-4 py-3 gap-3">
        <span className="text-2xl">🔍</span>
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && visibleRows.length > 0) {
              event.preventDefault();
              setHighlightedIndex((previous) => (previous + 1) % visibleRows.length);
              return;
            }

            if (event.key === "ArrowUp" && visibleRows.length > 0) {
              event.preventDefault();
              setHighlightedIndex((previous) => (previous - 1 + visibleRows.length) % visibleRows.length);
              return;
            }

            if (event.key === "Tab" && visibleRows.length > 0) {
              event.preventDefault();
              setHighlightedIndex((previous) => {
                if (event.shiftKey) {
                  return (previous - 1 + visibleRows.length) % visibleRows.length;
                }
                return (previous + 1) % visibleRows.length;
              });
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              submitHighlightedMatch();
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
          tabIndex={-1}
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
            visibleRows.map((pokemon, index) => (
              <li
                key={pokemon.id}
                className={`border-b border-black flex items-center justify-between gap-3 px-3 py-3 ${
                  index === highlightedIndex ? "bg-yellow-200" : ""
                }`}
              >
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
                  tabIndex={-1}
                  onClick={() => {
                    onSubmit(pokemon.id);
                    setQuery("");
                    setHighlightedIndex(0);
                    focusInput();
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
