import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppData } from "@/lib/domain/types";
import { appDataSchema } from "@/lib/domain/validation";

export interface Repository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function validPublicConfiguration(): boolean {
  if (
    !supabaseUrl ||
    !publishableKey ||
    publishableKey.startsWith("sb_secret_")
  )
    return false;
  try {
    return ["https:", "http:"].includes(new URL(supabaseUrl).protocol);
  } catch {
    return false;
  }
}
export const isSupabaseConfigured = validPublicConfiguration();
let client: SupabaseClient | null = null;

/** Browser public key only; authentication and RLS protect every database record. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || !supabaseUrl || !publishableKey) return null;
  if (!client)
    client = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  return client;
}

export const DEMO_STORAGE_KEY = "edgelab:demo:v1";

/** Local synthetic workspace. This repository is never copied to Supabase. */
export function createDemoRepository(): Repository {
  return {
    async load() {
      if (typeof window === "undefined") return null;
      const saved = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!saved) return null;
      try {
        return appDataSchema.parse(JSON.parse(saved)) as AppData;
      } catch {
        throw new Error(
          "Saved demo data is invalid. Export or clear the EdgeLab demo storage in browser settings to start again.",
        );
      }
    },
    async save(data) {
      if (typeof window === "undefined")
        throw new Error("Demo storage is available only in your browser.");
      const checked = appDataSchema.parse(data);
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(checked));
      } catch {
        throw new Error(
          "Demo changes could not be saved. Browser storage may be full or disabled.",
        );
      }
    },
  };
}

function assertLiveWorkspace(data: AppData): void {
  if (
    data.bets.some(
      (bet) =>
        bet.oddsProvenance?.simulated || bet.probabilityProvenance?.simulated,
    ) ||
    data.candidates.some(
      (candidate) =>
        candidate.oddsProvenance.simulated ||
        candidate.probabilityProvenance?.simulated,
    ) ||
    data.paperPredictions.some(
      (paper) =>
        paper.candidate.oddsProvenance.simulated ||
        paper.candidate.probabilityProvenance?.simulated,
    ) ||
    data.notifications.some((notification) => notification.simulated) ||
    data.researchRuns.some((run) => run.simulated)
  )
    throw new Error(
      "Simulated research cannot be saved in an authenticated workspace. Return to Demo mode for mock research.",
    );
}

/**
 * One transactional RPC per save. A revision check rejects stale browser tabs.
 * The caller must load before saving and retain this repository instance.
 */
export function createSupabaseRepository(userId: string): Repository {
  let revision: number | null = null;
  const requireClient = () => {
    const supabase = getSupabaseClient();
    if (!supabase)
      throw new Error(
        "Configure your public Supabase URL and publishable key first.",
      );
    return supabase;
  };
  const requireUser = async () => {
    const supabase = requireClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== userId)
      throw new Error("Your session changed. Sign in again before saving.");
    return supabase;
  };
  return {
    async load() {
      const supabase = await requireUser();
      const { data, error } = await supabase.rpc("edgelab_load_workspace");
      if (error)
        throw new Error(
          `Could not load your private workspace: ${error.message}`,
        );
      const response = data as { revision: number; workspace: unknown | null };
      if (!response || !Number.isSafeInteger(Number(response.revision)))
        throw new Error(
          "Unexpected database response. Check the EdgeLab migration version.",
        );
      revision = Number(response.revision);
      if (response.workspace === null) return null;
      const checked = appDataSchema.parse(response.workspace) as AppData;
      assertLiveWorkspace(checked);
      return checked;
    },
    async save(data) {
      const checked = appDataSchema.parse(data) as AppData;
      assertLiveWorkspace(checked);
      if (revision === null)
        throw new Error("Load your workspace before saving.");
      const supabase = await requireUser();
      const { data: nextRevision, error } = await supabase.rpc(
        "edgelab_save_workspace",
        {
          workspace: checked,
          expected_revision: revision,
        },
      );
      if (error) {
        if (error.message.includes("revision conflict"))
          throw new Error(
            "Your workspace changed in another tab. Reload to get the latest records before editing again.",
          );
        throw new Error(`Your changes were not saved: ${error.message}`);
      }
      if (
        !Number.isSafeInteger(Number(nextRevision)) ||
        Number(nextRevision) !== revision + 1
      ) {
        throw new Error(
          "Unexpected save response. Reload your workspace before making another change.",
        );
      }
      revision = Number(nextRevision);
    },
  };
}
