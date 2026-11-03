import { Suspense } from "react";
import { Notifications } from "@/components/notifications";
export default function Page() {
  return (
    <Suspense
      fallback={<div className="empty-state">Loading notifications…</div>}
    >
      <Notifications />
    </Suspense>
  );
}
