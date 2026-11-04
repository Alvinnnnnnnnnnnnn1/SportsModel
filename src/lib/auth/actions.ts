import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AUTH_CALLBACK_PATH } from "./callback";

type Credentials = { email: string; password: string };
type IdentityClient = { auth: Pick<SupabaseClient["auth"], "getUser"> };
type FormClient = {
  auth: Pick<
    SupabaseClient["auth"],
    "signUp" | "signInWithPassword" | "getUser" | "signOut"
  >;
};

/** Only controlled messages reach the form; raw SDK errors may contain request details. */
export class AuthActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthActionError";
  }
}

function formError(error: unknown, fallback: string): AuthActionError {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    invalid_credentials: "Email or password is incorrect.",
    email_not_confirmed: "Confirm your email before signing in.",
    over_email_send_rate_limit:
      "The email sending limit was reached. Wait before requesting another confirmation email.",
    email_address_not_authorized:
      "This email address is not authorized by the project's email service. Use an authorized address for confirmation testing.",
    weak_password:
      "Choose a stronger password that meets the project's password requirements.",
  };
  return new AuthActionError(
    Object.hasOwn(messages, code) ? messages[code] : fallback,
  );
}

export function confirmationRedirect(origin: string): string {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new AuthActionError("The current site origin is invalid.");
  }
  const localHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (!localHttp && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new AuthActionError("The current site origin is invalid.");
  return new URL(AUTH_CALLBACK_PATH, url.origin).toString();
}

/** getUser checks server identity; the SDK refreshes expired tokens before that request. */
export async function requireAuthenticatedUser(
  client: IdentityClient,
  expectedUserId?: string,
): Promise<User> {
  try {
    const { data, error } = await client.auth.getUser();
    if (
      error ||
      !data.user ||
      (expectedUserId && data.user.id !== expectedUserId)
    )
      throw new AuthActionError(
        "Your session changed or could not be verified. Sign in again before saving.",
      );
    return data.user;
  } catch (error) {
    if (error instanceof AuthActionError) throw error;
    throw new AuthActionError(
      "Your session could not be verified. Check your connection and try again before saving.",
    );
  }
}

export async function signUpWithEmail(
  client: FormClient,
  credentials: Credentials,
  origin: string,
): Promise<{
  status: "confirmation_required" | "authenticated";
  user: User | null;
}> {
  const redirect = confirmationRedirect(origin);
  try {
    const { data, error } = await client.auth.signUp({
      email: credentials.email.trim(),
      password: credentials.password,
      options: { emailRedirectTo: redirect },
    });
    if (error)
      throw formError(
        error,
        "Account creation could not be completed. Check your connection and try again.",
      );
    if (!data.session) return { status: "confirmation_required", user: null };
    const user = await requireAuthenticatedUser(client, data.user?.id);
    return { status: "authenticated", user };
  } catch (error) {
    if (error instanceof AuthActionError) throw error;
    throw formError(
      error,
      "Account creation could not be completed. Check your connection and try again.",
    );
  }
}

export async function signInWithEmail(
  client: FormClient,
  credentials: Credentials,
): Promise<User> {
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });
    if (error)
      throw formError(
        error,
        "Sign-in could not be completed. Check your connection and try again.",
      );
    if (!data.session || !data.user)
      throw new AuthActionError(
        "Sign-in did not return an authenticated session.",
      );
    return await requireAuthenticatedUser(client, data.user.id);
  } catch (error) {
    if (error instanceof AuthActionError) throw error;
    throw formError(
      error,
      "Sign-in could not be completed. Check your connection and try again.",
    );
  }
}

/** Revoke this session only; other devices/sessions must remain untouched. */
export async function signOutCurrentSession(
  client: { auth: Pick<SupabaseClient["auth"], "signOut"> },
): Promise<void> {
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new AuthActionError(
        "Logout could not be confirmed. Check your connection and retry; no remote revocation is claimed.",
      );
  } catch (error) {
    if (error instanceof AuthActionError) throw error;
    throw new AuthActionError(
      "Logout could not be confirmed. Check your connection and retry; no remote revocation is claimed.",
    );
  }
}
