"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { flushPendingScores } from "@/lib/leaderboard";
import { getSupabase } from "@/lib/supabase-client";

// -- Username + password identity over Supabase Auth ------------------------
//
// The user only ever sees a username field. Under the hood we synthesize a
// non-routable email (`<lowercased-username>@poketypeguessrldrbrd.local`) and
// feed it to Supabase Auth's email/password flow, so all hashing, sessions,
// and JWT issuance stay native — we just hide the email plumbing from the UI.
//
// Trade-off: there is no email-recovery flow, so a forgotten password is a
// dead account in v1. If we ever want recovery we can add an OPTIONAL
// `recovery_email` field to `profiles` without changing the auth identifier.

export const SYNTHETIC_EMAIL_DOMAIN = "poketypeguessrldrbrd.local";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export const toSyntheticEmail = (username: string) =>
  `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;

export type AuthUser = { id: string; username: string };

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authed"; user: AuthUser };

export type AuthError = { code: string; message: string };

export const validateUsername = (raw: string): AuthError | null => {
  const username = raw.trim().toLowerCase();
  if (!username) {
    return { code: "username_required", message: "Pick a username." };
  }
  if (!USERNAME_REGEX.test(username)) {
    return {
      code: "username_format",
      message:
        "Username must be 3–20 chars: lowercase letters, digits, or underscores.",
    };
  }
  return null;
};

export const validatePassword = (raw: string): AuthError | null => {
  if (!raw || raw.length < MIN_PASSWORD_LENGTH) {
    return {
      code: "password_too_short",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  return null;
};

const usernameFromMetadata = (raw: unknown): string => {
  if (raw && typeof raw === "object" && "username" in raw) {
    const value = (raw as { username?: unknown }).username;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
};

const userToAuthUser = async (
  supabase: ReturnType<typeof getSupabase>,
  authUser: { id: string; user_metadata?: Record<string, unknown> | null } | null,
): Promise<AuthUser | null> => {
  if (!supabase || !authUser) {
    return null;
  }
  const fromMeta = usernameFromMetadata(authUser.user_metadata);
  if (fromMeta) {
    return { id: authUser.id, username: fromMeta };
  }
  // Fallback: read the canonical username out of `profiles` if the metadata
  // hasn't propagated to the local session yet.
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", authUser.id)
    .maybeSingle();
  return { id: authUser.id, username: (data?.username as string | undefined) ?? "" };
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });
  const supabaseRef = useRef(getSupabase());

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) {
      setState({ status: "guest", user: null });
      return;
    }

    let active = true;

    const hydrate = async () => {
      const { data } = await supabase.auth.getUser();
      const user = await userToAuthUser(supabase, data.user);
      if (!active) return;
      setState(user ? { status: "authed", user } : { status: "guest", user: null });
    };

    void hydrate();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = await userToAuthUser(supabase, session?.user ?? null);
        if (!active) return;
        setState(user ? { status: "authed", user } : { status: "guest", user: null });
        // Best-effort: drain any locally-queued score submissions that
        // failed earlier. Fire-and-forget — flush failures stay queued.
        if (user) {
          void flushPendingScores(user.id);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (
      rawUsername: string,
      password: string,
    ): Promise<{ ok: true } | { ok: false; error: AuthError }> => {
      const supabase = supabaseRef.current;
      if (!supabase) {
        return {
          ok: false,
          error: { code: "supabase_missing", message: "Auth is not configured." },
        };
      }
      const usernameError = validateUsername(rawUsername);
      if (usernameError) return { ok: false, error: usernameError };
      const passwordError = validatePassword(password);
      if (passwordError) return { ok: false, error: passwordError };

      const username = rawUsername.trim().toLowerCase();

      // Pre-check uniqueness so the user gets a clear error instead of the
      // generic "User already registered" Supabase returns. This is racy
      // (someone could sign up between the check and signUp), but the unique
      // constraint on profiles.username is the actual guarantee.
      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existingError) {
        return {
          ok: false,
          error: {
            code: "lookup_failed",
            message: "Could not check username availability. Try again.",
          },
        };
      }
      if (existing) {
        return {
          ok: false,
          error: { code: "username_taken", message: "That username is taken." },
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: toSyntheticEmail(username),
        password,
        options: { data: { username } },
      });
      if (error) {
        return {
          ok: false,
          error: { code: error.code ?? "signup_failed", message: error.message },
        };
      }

      // If "Confirm email" is still toggled ON in Supabase Auth settings,
      // signUp returns a user with no session and the user is stuck. Try a
      // direct sign-in as a defensive fallback so dev catches the misconfig.
      if (!data.session) {
        const fallback = await supabase.auth.signInWithPassword({
          email: toSyntheticEmail(username),
          password,
        });
        if (fallback.error) {
          return {
            ok: false,
            error: {
              code: "email_confirmation_required",
              message:
                "Signup succeeded but couldn't sign in. Disable email confirmation in Supabase Auth settings.",
            },
          };
        }
      }

      return { ok: true };
    },
    [],
  );

  const signIn = useCallback(
    async (
      rawUsername: string,
      password: string,
    ): Promise<{ ok: true } | { ok: false; error: AuthError }> => {
      const supabase = supabaseRef.current;
      if (!supabase) {
        return {
          ok: false,
          error: { code: "supabase_missing", message: "Auth is not configured." },
        };
      }
      const usernameError = validateUsername(rawUsername);
      if (usernameError) return { ok: false, error: usernameError };
      if (!password) {
        return {
          ok: false,
          error: { code: "password_required", message: "Enter your password." },
        };
      }

      const username = rawUsername.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithPassword({
        email: toSyntheticEmail(username),
        password,
      });
      if (error) {
        return {
          ok: false,
          error: {
            code: error.code ?? "signin_failed",
            message:
              error.message === "Invalid login credentials"
                ? "Wrong username or password."
                : error.message,
          },
        };
      }
      return { ok: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { state, signUp, signIn, signOut };
};

// Debounced username availability lookup for the signup form.
//
// We separate synchronous-by-input states (`idle` / `invalid`) from the
// asynchronous result (`available` / `taken`). The sync states are derived
// directly from `raw`, so we don't fire setState() inside the effect just
// to display them — that keeps React's strict effect rules happy.
export type UsernameAvailability =
  | "idle"
  | "invalid"
  | "checking"
  | "available"
  | "taken";

type AsyncResult = { username: string; outcome: "available" | "taken" } | null;

export const useUsernameAvailability = (raw: string): UsernameAvailability => {
  const [asyncResult, setAsyncResult] = useState<AsyncResult>(null);

  const trimmed = raw.trim().toLowerCase();
  const formatOk = validateUsername(raw) === null;

  useEffect(() => {
    if (!formatOk) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", trimmed)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setAsyncResult(null);
        return;
      }
      setAsyncResult({ username: trimmed, outcome: data ? "taken" : "available" });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, formatOk]);

  if (raw.length === 0) return "idle";
  if (!formatOk) return "invalid";
  if (asyncResult && asyncResult.username === trimmed) return asyncResult.outcome;
  return "checking";
};
