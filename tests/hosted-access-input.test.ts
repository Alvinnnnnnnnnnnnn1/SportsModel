import { describe, expect, it } from "vitest";
import { isTestAccountEmail } from "../scripts/check-hosted-access.mjs";

describe("hosted test-account email input", () => {
  it.each([
    "edgelab-test-a-20261104@example.invalid",
    "edgelab-test-b-20261104@example.invalid",
    "user+dedicated@example.com",
    "Test.User@subdomain.example.invalid",
    "  edgelab-test-a-20261104@example.invalid  ",
  ])("accepts syntactically valid test addresses, including reserved domains: %s", (email) => {
    expect(isTestAccountEmail(email)).toBe(true);
  });

  it.each([
    "",
    "not-an-email",
    "@example.invalid",
    "user@",
    "user@example",
    "user@@example.invalid",
    "user name@example.invalid",
    "user@example. invalid",
    "Account A: user@example.invalid",
    "user@example.invalid\nother@example.invalid",
    "a".repeat(255) + "@example.invalid",
    undefined,
    null,
  ])("rejects malformed or non-string input without attempting authentication: %s", (value) => {
    expect(isTestAccountEmail(value)).toBe(false);
  });
});
