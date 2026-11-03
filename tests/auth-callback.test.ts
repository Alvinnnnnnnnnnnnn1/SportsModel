import { describe, expect, it, vi } from "vitest";
import {
  callbackErrorFromUrl,
  completeAuthCallback,
} from "../src/lib/auth/callback";

function authClient() {
  const initialize = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
  return { client: { auth: { initialize, getUser } }, initialize, getUser };
}

describe("authentication callback", () => {
  it("recognizes expired links without reflecting descriptions or tokens", () => {
    const message = callbackErrorFromUrl(
      "http://localhost:3000/auth/callback#error=access_denied&error_code=otp_expired&error_description=private-value&access_token=never-display",
    );
    expect(message).toContain("expired");
    expect(message).not.toContain("private-value");
    expect(message).not.toContain("never-display");
  });

  it("handles query redirect errors and malformed URLs with safe messages", () => {
    expect(
      callbackErrorFromUrl(
        "http://localhost:3000/auth/callback?error_description=untrusted-script",
      ),
    ).toContain("invalid");
    expect(callbackErrorFromUrl("not a URL")).toContain("invalid");
  });

  it("rejects an error redirect even when an unrelated session exists", async () => {
    const { client, initialize, getUser } = authClient();
    const result = await completeAuthCallback(
      client,
      "http://localhost:3000/auth/callback#error_code=otp_expired",
    );
    expect(result.status).toBe("error");
    expect(initialize).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("checks SDK initialization and then verifies the authenticated user", async () => {
    const { client, initialize, getUser } = authClient();
    expect(
      await completeAuthCallback(client, "http://localhost:3000/auth/callback"),
    ).toEqual({ status: "success" });
    expect(initialize).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("does not report authentication success after SDK token parsing fails", async () => {
    const { client, initialize, getUser } = authClient();
    initialize.mockResolvedValue({
      error: { message: "sensitive-token-error" },
    });
    const result = await completeAuthCallback(
      client,
      "http://localhost:3000/auth/callback#access_token=malformed",
    );
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("sensitive-token-error");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("requires a real authenticated user rather than trusting a callback URL", async () => {
    const { client, getUser } = authClient();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(
      (
        await completeAuthCallback(
          client,
          "http://localhost:3000/auth/callback?next=https://example.com",
        )
      ).status,
    ).toBe("error");
    getUser.mockResolvedValue({
      data: { user: { id: "stale" } },
      error: { message: "expired" },
    });
    expect(
      (
        await completeAuthCallback(
          client,
          "http://localhost:3000/auth/callback",
        )
      ).status,
    ).toBe("error");
  });

  it("reports service failures without exposing exception text", async () => {
    const { client, initialize } = authClient();
    initialize.mockRejectedValue(new Error("token-bearing internal failure"));
    const result = await completeAuthCallback(
      client,
      "http://localhost:3000/auth/callback",
    );
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).toContain("could not be reached");
    expect(JSON.stringify(result)).not.toContain("token-bearing");
  });
});
