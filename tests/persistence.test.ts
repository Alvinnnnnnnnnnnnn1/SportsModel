import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoData, createEmptyData } from "../src/lib/domain/fixtures";

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mock.createClient(...args);
    return { auth: { getUser: mock.getUser }, rpc: mock.rpc };
  },
}));

const userId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_test_public",
  );
  mock.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function browserStorage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
  vi.stubGlobal("window", { localStorage });
  return { values, localStorage };
}

describe("demo repository isolation", () => {
  it("round-trips a validated workspace only through the demo storage key", async () => {
    const { values } = browserStorage();
    const { createDemoRepository, DEMO_STORAGE_KEY } =
      await import("../src/lib/persistence");
    const repository = createDemoRepository();
    expect(await repository.load()).toBeNull();
    const data = createEmptyData();
    await repository.save(data);
    expect(await repository.load()).toEqual(data);
    expect([...values.keys()]).toEqual([DEMO_STORAGE_KEY]);
    expect(mock.createClient).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("reports corrupt saved data without silently overwriting history", async () => {
    const { values, localStorage } = browserStorage();
    const { createDemoRepository, DEMO_STORAGE_KEY } =
      await import("../src/lib/persistence");
    values.set(DEMO_STORAGE_KEY, "{broken");
    await expect(createDemoRepository().load()).rejects.toThrow(
      "Saved demo data is invalid",
    );
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("reports storage failure instead of claiming a successful save", async () => {
    const { localStorage } = browserStorage();
    localStorage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const { createDemoRepository } = await import("../src/lib/persistence");
    await expect(
      createDemoRepository().save(createEmptyData()),
    ).rejects.toThrow("could not be saved");
  });
});

describe("public client configuration", () => {
  it("uses the configured public project and persistent browser authentication", async () => {
    const { getSupabaseClient } = await import("../src/lib/persistence");
    const first = getSupabaseClient();
    expect(getSupabaseClient()).toBe(first);
    expect(mock.createClient).toHaveBeenCalledTimes(1);
    expect(mock.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_test_public",
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "implicit",
        },
      },
    );
  });

  it("keeps credential-free demo functional and rejects malformed connection URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    let persistence = await import("../src/lib/persistence");
    expect(persistence.isSupabaseConfigured).toBe(false);
    expect(persistence.getSupabaseClient()).toBeNull();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    persistence = await import("../src/lib/persistence");
    expect(persistence.getSupabaseClient()).toBeNull();
    expect(mock.createClient).not.toHaveBeenCalled();
  });
});

describe("authenticated repository", () => {
  it("requires a successful load before saving and propagates optimistic revisions", async () => {
    const { createSupabaseRepository } = await import("../src/lib/persistence");
    const repository = createSupabaseRepository(userId);
    await expect(repository.save(createEmptyData())).rejects.toThrow(
      "Load your workspace",
    );
    mock.rpc.mockResolvedValueOnce({
      data: { revision: 0, workspace: null },
      error: null,
    });
    expect(await repository.load()).toBeNull();
    mock.rpc.mockResolvedValueOnce({ data: 1, error: null });
    await repository.save(createEmptyData());
    expect(mock.rpc).toHaveBeenLastCalledWith("edgelab_save_workspace", {
      workspace: createEmptyData(),
      expected_revision: 0,
    });
    mock.rpc.mockResolvedValueOnce({ data: 2, error: null });
    await repository.save(createEmptyData());
    expect(mock.rpc).toHaveBeenLastCalledWith("edgelab_save_workspace", {
      workspace: createEmptyData(),
      expected_revision: 1,
    });
  });

  it("rejects synthetic fixture history before calling a save RPC", async () => {
    const { createSupabaseRepository } = await import("../src/lib/persistence");
    const repository = createSupabaseRepository(userId);
    mock.rpc.mockResolvedValueOnce({
      data: { revision: 0, workspace: null },
      error: null,
    });
    await repository.load();
    mock.rpc.mockClear();
    await expect(repository.save(createDemoData())).rejects.toThrow(
      "Simulated research",
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("does not retry or advance its revision when another tab has changed the workspace", async () => {
    const { createSupabaseRepository } = await import("../src/lib/persistence");
    const repository = createSupabaseRepository(userId);
    mock.rpc.mockResolvedValueOnce({
      data: { revision: 4, workspace: createEmptyData() },
      error: null,
    });
    await repository.load();
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Workspace revision conflict; reload before saving" },
    });
    await expect(repository.save(createEmptyData())).rejects.toThrow(
      "changed in another tab",
    );
    expect(mock.rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects operations after the authenticated identity changes", async () => {
    const { createSupabaseRepository } = await import("../src/lib/persistence");
    mock.getUser.mockResolvedValueOnce({
      data: { user: { id: "another-user" } },
      error: null,
    });
    await expect(createSupabaseRepository(userId).load()).rejects.toThrow(
      "session changed",
    );
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
