import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "filled" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

export default function Button({
  children,
  href,
  onClick,
  variant = "filled",
  size = "lg",
  className,
  type = "button",
  disabled = false,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium transition-all duration-300",
    size === "lg" ? "h-14 px-8 text-base" : size === "sm" ? "h-8 px-3.5 text-xs" : "h-10 px-5 text-sm",
    variant === "filled"
      ? "bg-foreground text-background hover:opacity-85"
      : "bg-transparent text-foreground border border-foreground/20 hover:border-foreground/50",
    disabled && "opacity-50 cursor-not-allowed",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
