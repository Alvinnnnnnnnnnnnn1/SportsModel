import type { Metadata } from "next";
import { AuthCallback } from "@/components/auth-callback";
export const metadata: Metadata = { title: "Authentication callback" };
export default function Page() {
  return <AuthCallback />;
}
