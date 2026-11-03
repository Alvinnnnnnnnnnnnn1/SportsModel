import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_SETTINGS_PATH = "/settings";

type CallbackClient = {
  auth: Pick<SupabaseClient["auth"], "initialize" | "getUser">;
};
export type AuthCallbackResult =
  { status: "success" } | { status: "error"; message: string };

const invalidLink =
  "This authentication link is invalid or could not be completed. Open Settings to sign in or request a new confirmation email.";
const expiredLink =
  "This authentication link has expired or was already used. Open Settings to sign in or request a new confirmation email.";

/** Return a safe message, never arbitrary URL text or credentials from a redirect. */
export function callbackErrorFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const query = url.searchParams;
    const fragment = new URLSearchParams(url.hash.slice(1));
    for (const params of [query, fragment]) {
      if (
        params.has("error") ||
        params.has("error_code") ||
        params.has("error_description")
      ) {
        return params.get("error_code") === "otp_expired"
          ? expiredLink
          : invalidLink;
      }
    }
    return null;
  } catch {
    return invalidLink;
  }
}

/** The existing browser SDK owns token parsing/storage; verify the resulting user remotely. */
export async function completeAuthCallback(
  client: CallbackClient,
  originalUrl: string,
): Promise<AuthCallbackResult> {
  const urlError = callbackErrorFromUrl(originalUrl);
  if (urlError) return { status: "error", message: urlError };
  try {
    const initialized = await client.auth.initialize();
    if (initialized.error) return { status: "error", message: invalidLink };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { status: "error", message: invalidLink };
    return { status: "success" };
  } catch {
    return {
      status: "error",
      message:
        "The authentication service could not be reached. Open Settings and try signing in again.",
    };
  }
}
