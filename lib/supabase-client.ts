"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// All auth + leaderboard work happens in the browser via this singleton.
// We intentionally do NOT use @supabase/ssr because we have no server
// components that need user identity, and Next.js 16's async cookies()/
// proxy.ts changes would otherwise need their own plumbing. Leaderboard writes
// go through Supabase Edge Functions (`start-run` + `finish-run`) bound to the
// authed session, and reads still flow through RLS-protected tables.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let cached: SupabaseClient | null = null;

export const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);

export const getSupabase = (): SupabaseClient | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    if (typeof console !== "undefined") {
      console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Auth + leaderboard disabled.",
      );
    }
    return null;
  }
  if (!cached) {
    cached = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cached;
};
