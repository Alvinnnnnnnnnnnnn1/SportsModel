"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, LoaderCircle, ShieldAlert } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/persistence";
import {
  AUTH_CALLBACK_PATH,
  AUTH_SETTINGS_PATH,
  completeAuthCallback,
  type AuthCallbackResult,
} from "@/lib/auth/callback";

export function AuthCallback() {
  const { setMode } = useApp();
  const selectWorkspace = useRef(setMode);
  const [result, setResult] = useState<AuthCallbackResult | null>(null);

  // Context actions are recreated with workspace state; keep a current action without restarting authentication.
  useEffect(() => {
    selectWorkspace.current = setMode;
  }, [setMode]);
  useEffect(() => {
    let active = true;
    const finish = async () => {
      const originalUrl = window.location.href;
      const client = getSupabaseClient();
      const outcome: AuthCallbackResult = client
        ? await completeAuthCallback(client, originalUrl)
        : {
            status: "error",
            message:
              "Supabase is not configured. Configure the local public environment variables and restart EdgeLab.",
          };
      // No token, error description or untrusted redirect remains in the address bar.
      window.history.replaceState(window.history.state, "", AUTH_CALLBACK_PATH);
      if (!active) return;
      if (outcome.status === "success") selectWorkspace.current("supabase");
      setResult(outcome);
    };
    void finish();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="panel mx-auto max-w-xl p-6 sm:p-8" aria-live="polite">
      <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
        {!result ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : result.status === "success" ? (
          <CircleCheck className="size-5" />
        ) : (
          <ShieldAlert className="size-5 text-amber-200" />
        )}
      </div>
      <p className="section-kicker mb-2">Private workspace authentication</p>
      <h1 className="page-heading">
        {!result
          ? "Completing sign-in…"
          : result.status === "success"
            ? "Authentication complete"
            : "Authentication needs attention"}
      </h1>
      <p
        className="muted mt-4 text-sm leading-relaxed"
        role={result?.status === "error" ? "alert" : undefined}
      >
        {!result
          ? "Checking your confirmation link and authenticated session."
          : result.status === "success"
            ? "Your authenticated session is ready. Continue to Settings to review your account and private workspace. Demo history remains separate."
            : result.message}
      </p>
      {result && (
        <Button asChild className="mt-6">
          <Link href={AUTH_SETTINGS_PATH}>Continue to Settings</Link>
        </Button>
      )}
    </section>
  );
}
