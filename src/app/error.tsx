"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div role="alert" className="panel p-8">
      <h1 className="text-xl font-medium">This view could not be displayed.</h1>
      <p className="my-3 text-sm text-muted-foreground">
        Your saved records remain in their workspace. Retry to reload this view.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
