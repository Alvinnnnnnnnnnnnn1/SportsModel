import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { confirmationRedirect, requireAuthenticatedUser, signInWithEmail, signOutCurrentSession, signUpWithEmail } from "../src/lib/auth/actions";
import { completeAuthCallback } from "../src/lib/auth/callback";

// Actual installed Supabase SDK, synthetic responses only. No HTTP leaves this process.
const origin = "https://auth-sdk-test.invalid";
const id = "10000000-0000-4000-8000-000000000001";
const otherId = "10000000-0000-4000-8000-000000000002";
const user = (userId = id): User => ({ id: userId, aud: "authenticated", role: "authenticated", email: `synthetic-${userId}@example.invalid`, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-01T00:01:00Z" });
function token(userId: string, expiresAt: number) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, role: "authenticated", exp: expiresAt })}.synthetic-signature-not-a-real-credential`;
}
function session(userId = id, expiresAt = Math.floor(Date.now() / 1000) + 3600, refresh = "synthetic-refresh-token") {
  return { access_token: token(userId, expiresAt), refresh_token: refresh, token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: user(userId) };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" } });
interface Request { url: URL; method: string; headers: Headers; body: Record<string, unknown>; }
const clients: SupabaseClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map(client => client.auth.stopAutoRefresh()));
  vi.restoreAllMocks();
});
function sdk(handler: (request: Request) => Promise<Response> | Response, seed?: unknown) {
  const storageKey = `edgelab-auth-sdk-test-${clients.length}-${Math.random()}`;
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(storageKey, JSON.stringify(seed));
  const requests: Request[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof globalThis.Request ? input.url : String(input));
    if (url.origin !== origin) throw new Error("Unexpected external request blocked by local auth fixture");
    const request = { url, method: init?.method ?? "GET", headers: new Headers(init?.headers), body: typeof init?.body === "string" ? JSON.parse(init.body) : {} };
    requests.push(request);
    return handler(request);
  };
  const client = createClient(origin, "sb_publishable_synthetic_test_only", { global: { fetch: transport }, auth: { storageKey, storage: { getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); }, removeItem: key => { store.delete(key); } }, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, debug: false } });
  clients.push(client);
  return { client, store, storageKey, requests };
}

function backendUser(request: Request) {
  if (request.url.pathname === "/auth/v1/user") return response(user());
  throw new Error("Unexpected local mock endpoint");
}

describe("installed SDK session recovery with isolated fake HTTP", () => {
  it("refreshes an expired session before verifying the user and persists rotated tokens", async () => {
    const expired = session(id, Math.floor(Date.now() / 1000) - 60, "old-synthetic-refresh");
    const refreshed = session(id, Math.floor(Date.now() / 1000) + 3600, "rotated-synthetic-refresh");
    const { client, store, storageKey, requests } = sdk(request => {
      if (request.url.pathname === "/auth/v1/token") {
        expect(request.url.searchParams.get("grant_type")).toBe("refresh_token");
        expect(request.body.refresh_token).toBe(expired.refresh_token);
        return response(refreshed);
      }
      expect(request.headers.get("Authorization")).toBe(`Bearer ${refreshed.access_token}`);
      return backendUser(request);
    }, expired);
    expect((await requireAuthenticatedUser(client, id)).id).toBe(id);
    expect(requests.map(r => r.url.pathname)).toEqual(["/auth/v1/token", "/auth/v1/user"]);
    expect(JSON.parse(store.get(storageKey)!).refresh_token).toBe(refreshed.refresh_token);
  });

  it("single-flights concurrent expired-session checks instead of rotating twice", async () => {
    let refreshes = 0;
    const { client } = sdk(async request => {
      if (request.url.pathname === "/auth/v1/token") { refreshes++; await Promise.resolve(); return response(session()); }
      return backendUser(request);
    }, session(id, Math.floor(Date.now() / 1000) - 30));
    const verified = await Promise.all([requireAuthenticatedUser(client, id), requireAuthenticatedUser(client, id)]);
    expect(verified.map(value => value.id)).toEqual([id, id]);
    expect(refreshes).toBe(1);
  });

  it("clears a truly expired session after a revoked refresh and prevents protected work", async () => {
    // The SDK logs a rejected refresh internally; application-facing text stays controlled.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let protectedWork = 0;
    const { client, store, storageKey, requests } = sdk(request => {
      expect(request.url.pathname).toBe("/auth/v1/token");
      return response({ error_code: "refresh_token_not_found", message: "private-refresh-error" }, 400);
    }, session(id, Math.floor(Date.now() / 1000) - 30));
    await expect((async () => { await requireAuthenticatedUser(client, id); protectedWork++; })()).rejects.toThrow("session changed");
    expect(store.has(storageKey)).toBe(false);
    expect(protectedWork).toBe(0);
    expect(requests.some(r => r.url.pathname.startsWith("/rest/"))).toBe(false);
  });

  it("removes a malformed stored session without sending protected requests", async () => {
    const { client, store, storageKey, requests } = sdk(() => { throw new Error("Malformed session must not leave the local fixture"); }, { access_token: "malformed" });
    await expect(requireAuthenticatedUser(client, id)).rejects.toThrow("session changed");
    expect(store.has(storageKey)).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it("fails closed and clears a server-revoked session instead of trusting stored identity", async () => {
    const { client, store, storageKey } = sdk(() => response({ error_code: "session_not_found", message: "server-private-session-detail" }, 401), session());
    await expect(requireAuthenticatedUser(client, id)).rejects.toThrow("session changed");
    expect(store.has(storageKey)).toBe(false);
  });

  it("preserves the session on a transient verification failure and allows a later retry", async () => {
    let unavailable = true;
    const initial = session();
    const { client, store, storageKey } = sdk(request => unavailable ? response({ message: "private-token-bearing-service-failure" }, 503) : backendUser(request), initial);
    await expect(requireAuthenticatedUser(client, id)).rejects.toThrow("session changed");
    expect(JSON.parse(store.get(storageKey)!).access_token).toBe(initial.access_token);
    unavailable = false;
    expect((await requireAuthenticatedUser(client, id)).id).toBe(id);
  });

  it("does not accept another authenticated account for a queued user's save", async () => {
    const { client } = sdk(() => response(user(otherId)), session(otherId));
    await expect(requireAuthenticatedUser(client, id)).rejects.toThrow("session changed");
  });
});

describe("actual SDK signup, confirmation state and form actions with fake transport", () => {
  it("requests the exact local callback and keeps confirmation-pending users out of private mode", async () => {
    const { client, store, storageKey, requests } = sdk(request => {
      expect(request.url.pathname).toBe("/auth/v1/signup");
      expect(request.url.searchParams.get("redirect_to")).toBe("http://localhost:3000/auth/callback");
      expect(request.body.email).toBe("fixture@example.invalid");
      return response({ ...user(), email_confirmed_at: undefined });
    });
    expect(await signUpWithEmail(client, { email: " fixture@example.invalid ", password: "synthetic-password-not-real" }, "http://localhost:3000")).toEqual({ status: "confirmation_required", user: null });
    expect(store.has(storageKey)).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it("handles unconfirmed sign-in, then verifies a simulated confirmation and authenticated callback", async () => {
    let confirmed = false;
    const { client } = sdk(request => {
      if (request.url.pathname === "/auth/v1/token") return confirmed ? response(session()) : response({ error_code: "email_not_confirmed", message: "raw-private-mail-detail" }, 400);
      return backendUser(request);
    });
    const credentials = { email: "fixture@example.invalid", password: "synthetic-password-not-real" };
    await expect(signInWithEmail(client, credentials)).rejects.toThrow("Confirm your email");
    confirmed = true; // Mocked provider confirmation; no real email or remote action.
    expect((await signInWithEmail(client, credentials)).id).toBe(id);
    expect(await completeAuthCallback(client, "http://localhost:3000/auth/callback")).toEqual({ status: "success" });
  });

  it("only reports an immediate signup session after server-user verification", async () => {
    const { client } = sdk(request => request.url.pathname === "/auth/v1/signup" ? response(session()) : backendUser(request));
    const result = await signUpWithEmail(client, { email: "fixture@example.invalid", password: "synthetic-password-not-real" }, "https://local-fixture.example");
    expect(result.status).toBe("authenticated");
    expect(result.user?.id).toBe(id);
  });

  it("shows controlled credential errors rather than reflecting provider response details", async () => {
    const { client } = sdk(() => response({ error_code: "invalid_credentials", message: "token=never-reflect-this" }, 400));
    await expect(signInWithEmail(client, { email: "fixture@example.invalid", password: "synthetic-password-not-real" })).rejects.toThrow("Email or password is incorrect");
  });

  it("does not reflect unknown or inherited provider error codes", async () => {
    for (const code of ["unrecognized_provider_failure", "toString", "__proto__"]) {
      const { client } = sdk(() => response({ error_code: code, message: "private-auth-failure" }, 400));
      await expect(signInWithEmail(client, { email: "fixture@example.invalid", password: "synthetic-password-not-real" })).rejects.toThrow("Sign-in could not be completed");
    }
  });

  it("restricts confirmation redirects to a site origin and one fixed callback path", () => {
    expect(confirmationRedirect("http://localhost:3000")).toBe("http://localhost:3000/auth/callback");
    expect(confirmationRedirect("https://app.example")).toBe("https://app.example/auth/callback");
    for (const origin of ["javascript:alert(1)", "http://external.example", "https://app.example/next?token=private", "https://user:private@app.example", "not a URL"]) expect(() => confirmationRedirect(origin)).toThrow("origin is invalid");
  });

  it("logs out only the current session and removes it without ending another client session", async () => {
    let logoutScope = "";
    const a = sdk(request => {
      if (request.url.pathname === "/auth/v1/logout") { logoutScope = request.url.searchParams.get("scope") ?? ""; return new Response(null, { status: 204 }); }
      return backendUser(request);
    }, session());
    const b = sdk(() => response(user(otherId)), session(otherId));
    await signOutCurrentSession(a.client);
    expect(logoutScope).toBe("local");
    expect(a.store.has(a.storageKey)).toBe(false);
    expect(b.store.has(b.storageKey)).toBe(true);
    await expect(requireAuthenticatedUser(a.client, id)).rejects.toThrow("session changed");
    expect((await requireAuthenticatedUser(b.client, otherId)).id).toBe(otherId);
  });

  it("does not claim remote logout succeeded on a service failure, while the SDK clears local state", async () => {
    const { client, store, storageKey } = sdk(() => response({ message: "private-logout-service-error" }, 503), session());
    await expect(signOutCurrentSession(client)).rejects.toThrow("Logout could not be confirmed");
    expect(store.has(storageKey)).toBe(false);
  });
});
