import type { SupabaseClient } from "@supabase/supabase-js";
export function isTestAccountEmail(value: unknown): boolean;
export class CheckFailure extends Error {}
export function apiOk<T>(response: { data: T; error: { code?: string } | null }, operation: string): T;
export function clientFor(url: string, key: string, storage?: Map<string, string>): SupabaseClient;
export function credentialsFromTerminal(): Promise<{ a: { email: string; password: string }; b: { email: string; password: string } }>;
export function publicConfiguration(): Promise<{ url: string; key: string }>;
export function publicFailure(error: unknown): string;
export function signIn(client: SupabaseClient, credentials: { email: string; password: string }): Promise<string>;
