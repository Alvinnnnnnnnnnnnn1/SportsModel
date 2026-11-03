import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 [&_svg]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-emerald-300 shadow-sm",
        secondary: "bg-secondary text-foreground hover:bg-white/10",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-white/5",
        ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        destructive: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-md px-3 text-xs",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
export { buttonVariants };
