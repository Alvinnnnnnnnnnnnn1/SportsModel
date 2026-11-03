"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
      <Primitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5 space-y-2 pr-6", className)} {...props} />;
}
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Title>) {
  return (
    <Primitive.Title
      className={cn("text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Description>) {
  return (
    <Primitive.Description
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-wrap justify-end gap-2", className)}
      {...props}
    />
  );
}
