import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}
export function signedMoney(cents: number) {
  return `${cents > 0 ? "+" : ""}${money(cents)}`;
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
export function percent(value: number | null, digits = 1) {
  return value === null ? "—" : `${value.toFixed(digits)}%`;
}
export function freshness(timestamp: string, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(timestamp)) / 60000),
  );
  return minutes < 1
    ? "Just generated"
    : minutes < 60
      ? `${minutes}m old`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h old`
        : `${Math.floor(minutes / 1440)}d old · stale`;
}
