import Image from "next/image";

import { TYPE_COLORS, typeIconUrl } from "@/lib/type-colors";
import type { PokemonType } from "@/lib/types";

type TypeBadgeProps = {
  type: PokemonType;
  large?: boolean;
};

export function TypeBadge({ type, large = false }: TypeBadgeProps) {
  return (
    <div
      className={`border-4 border-black rounded-md flex items-center justify-center overflow-hidden ${
        large ? "w-[220px] h-[80px] gap-2 px-3" : "w-[150px] h-[52px] gap-2 px-2"
      }`}
      style={{ backgroundColor: TYPE_COLORS[type] }}
    >
      <Image
        src={typeIconUrl(type)}
        alt={`${type} icon`}
        width={large ? 36 : 24}
        height={large ? 36 : 24}
        className="pixel-img"
        unoptimized
      />
      <span
        className={`${
          large ? "text-[10px]" : "text-[8px]"
        } font-press text-white type-text leading-none whitespace-nowrap`}
      >
        {type.toUpperCase()}
      </span>
    </div>
  );
}
