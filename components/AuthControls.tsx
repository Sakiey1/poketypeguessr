"use client";

import { useState } from "react";

import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/lib/use-auth";

export function AuthControls() {
  const { state, signOut } = useAuth();
  const [modalMode, setModalMode] = useState<"signin" | "signup" | null>(null);

  const open = (mode: "signin" | "signup") => setModalMode(mode);
  const close = () => setModalMode(null);

  const inner = (() => {
    switch (state.status) {
      case "loading":
        return (
          <span className="font-pixel text-lg text-black/50">…</span>
        );
      case "authed":
        return (
          <div className="flex items-center gap-2">
            <span className="font-press text-[10px] uppercase tracking-wide">
              {state.user.username}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="border-2 border-black bg-white px-2 py-1 font-press text-[10px] uppercase hover:bg-black hover:text-white"
            >
              Sign Out
            </button>
          </div>
        );
      case "guest":
      default:
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => open("signin")}
              className="border-2 border-black bg-white px-2 py-1 font-press text-[10px] uppercase hover:bg-black hover:text-white"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => open("signup")}
              className="border-2 border-black bg-[#9bbc0f] px-2 py-1 font-press text-[10px] uppercase hover:bg-black hover:text-[#9bbc0f]"
            >
              Sign Up
            </button>
          </div>
        );
    }
  })();

  return (
    <>
      {inner}
      <AuthModal
        open={modalMode !== null}
        initialMode={modalMode ?? "signin"}
        onClose={close}
      />
    </>
  );
}
