import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

export function PixelButton({
  className,
  variant = "primary",
  disabled,
  ...props
}: PixelButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={clsx(
        "font-pixel text-sm px-4 py-2 border-4 border-black uppercase tracking-wide transition-all",
        "shadow-[3px_3px_0_0_#1a1a1a] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_0_#1a1a1a]",
        {
          "bg-[#9bbc0f] text-black hover:bg-black hover:text-[#9bbc0f]":
            variant === "primary",
          "bg-[#f7f4e7] text-black hover:bg-black hover:text-[#f7f4e7]":
            variant === "secondary",
          "bg-[#c03028] text-white hover:bg-black hover:text-[#c03028]":
            variant === "danger",
          "opacity-40 cursor-not-allowed hover:bg-inherit hover:text-inherit active:translate-x-0 active:translate-y-0":
            disabled,
        },
        className,
      )}
    />
  );
}
