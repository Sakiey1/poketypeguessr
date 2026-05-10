"use client";

import { useState } from "react";

import { PixelButton } from "@/components/PixelButton";
import {
  useAuth,
  useUsernameAvailability,
  validatePassword,
  validateUsername,
  type AuthError,
} from "@/lib/use-auth";

type Mode = "signin" | "signup";

type AuthModalProps = {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onAuthed?: () => void;
  // Optional title override for contextual triggers (e.g. "Sign in to save your score")
  title?: string;
};

const SUBMIT_BUSY_LABEL: Record<Mode, string> = {
  signin: "Signing in...",
  signup: "Creating account...",
};

export function AuthModal({ open, initialMode = "signin", onClose, onAuthed, title }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(null);
  const [busy, setBusy] = useState(false);

  const availability = useUsernameAvailability(mode === "signup" ? username : "");

  // Note: when `open` flips false→true the modal is remounted (we return
  // null below when closed), so useState defaults already reset the form.
  // No effect needed.
  if (!open) {
    return null;
  }

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await signIn(username, password)
          : await signUp(username, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onAuthed?.();
      onClose();
      setUsername("");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const usernameClientError = username.length > 0 ? validateUsername(username) : null;
  const passwordClientError = password.length > 0 ? validatePassword(password) : null;
  const canSubmitSignup =
    !usernameClientError &&
    !passwordClientError &&
    availability !== "taken" &&
    availability !== "invalid" &&
    availability !== "checking";
  const canSubmitSignin = username.length > 0 && password.length > 0;
  const canSubmit = (mode === "signin" ? canSubmitSignin : canSubmitSignup) && !busy;

  const heading = title ?? (mode === "signin" ? "Sign In" : "Create Account");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border-4 border-black bg-white p-5 md:p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-press text-base md:text-lg">{heading}</h2>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-black px-2 py-1 font-press text-[10px] hover:bg-black hover:text-white"
          >
            X
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`border-2 border-black py-2 font-press text-[10px] uppercase tracking-wide ${
              mode === "signin" ? "bg-black text-[#9bbc0f]" : "bg-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`border-2 border-black py-2 font-press text-[10px] uppercase tracking-wide ${
              mode === "signup" ? "bg-black text-[#9bbc0f]" : "bg-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              void submit();
            }
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="font-press text-[10px] uppercase">Username</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase().slice(0, 20))
              }
              maxLength={20}
              className="mt-1 w-full border-4 border-black bg-[#f7f4e7] px-3 py-2 font-pixel text-2xl"
              placeholder="ash_ketchum"
            />
            {mode === "signup" && (
              <UsernameHint
                username={username}
                clientError={usernameClientError}
                availability={availability}
              />
            )}
          </label>

          <label className="block">
            <span className="font-press text-[10px] uppercase">Password</span>
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border-4 border-black bg-[#f7f4e7] px-3 py-2 font-pixel text-2xl"
              placeholder="********"
            />
            {mode === "signup" && passwordClientError && (
              <span className="mt-1 block font-pixel text-lg text-[#c03028]">
                {passwordClientError.message}
              </span>
            )}
          </label>

          {error && (
            <p className="font-pixel text-xl text-[#c03028]">{error.message}</p>
          )}

          <PixelButton
            type="submit"
            disabled={!canSubmit}
            className="w-full text-lg py-3"
          >
            {busy
              ? SUBMIT_BUSY_LABEL[mode]
              : mode === "signin"
                ? "Sign In"
                : "Create Account"}
          </PixelButton>
        </form>

        <p className="font-pixel text-base text-black/60">No email needed.</p>
      </div>
    </div>
  );
}

function UsernameHint({
  username,
  clientError,
  availability,
}: {
  username: string;
  clientError: AuthError | null;
  availability: ReturnType<typeof useUsernameAvailability>;
}) {
  if (username.length === 0) {
    return (
      <span className="mt-1 block font-pixel text-base text-black/50">
        3–20 chars: lowercase letters, digits, underscores.
      </span>
    );
  }
  if (clientError) {
    return (
      <span className="mt-1 block font-pixel text-lg text-[#c03028]">
        {clientError.message}
      </span>
    );
  }
  switch (availability) {
    case "checking":
      return (
        <span className="mt-1 block font-pixel text-lg text-black/60">
          Checking availability...
        </span>
      );
    case "available":
      return (
        <span className="mt-1 block font-pixel text-lg text-[#3a7a2e]">
          Looks good — that username is free.
        </span>
      );
    case "taken":
      return (
        <span className="mt-1 block font-pixel text-lg text-[#c03028]">
          That username is taken.
        </span>
      );
    default:
      return null;
  }
}
