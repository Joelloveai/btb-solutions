import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted",
        accent: "bg-accent text-white shadow-sm hover:bg-accent-strong",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 text-sm md:h-10",
        sm: "h-9 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

// The app's original variant names are kept so existing call sites do not change.
const legacy = { primary: "default", secondary: "outline", danger: "destructive", ghost: "ghost", accent: "accent" } as const;
type Variant = keyof typeof legacy;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  small?: boolean;
  asChild?: boolean;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", small = false, asChild = false, className, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant: legacy[variant], size: small ? "sm" : "default" }), className)}
      {...props}
    />
  );
});

/** For links that should look like buttons (`<Link className={linkButton("accent", true)}>`). */
export function linkButton(variant: Variant = "primary", small = false) {
  return buttonVariants({ variant: legacy[variant], size: small ? "sm" : "default" });
}

export { Button, buttonVariants };
