"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";

import ModelStatusModal from "@/components/ModelStatusModal";

const LINKS = [
  { href: "/#capabilities", label: "Capabilities" },
  { href: "/about", label: "About" },
  { href: "/how-to-use", label: "How to Use" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="group relative font-sans text-sm text-foreground/80 hover:text-foreground">
      {label}
      <span className="absolute -bottom-1 left-0 h-px w-0 bg-foreground transition-all duration-300 group-hover:w-full" />
    </Link>
  );
}

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50">
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-500",
            scrolled
              ? "mx-4 mt-4 rounded-2xl border border-foreground/10 bg-background/95 px-6 py-3 shadow-sm backdrop-blur-md"
              : "mx-0 mt-0 rounded-none border-transparent bg-transparent px-6 py-3.5 sm:px-10 sm:py-4"
          )}
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="font-sans text-lg font-semibold tracking-tight text-foreground">
              Watershed Signal
            </Link>
            <button
              onClick={() => setShowModelModal(true)}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 font-mono text-[11px] text-foreground/80 hover:border-foreground/40 hover:text-foreground transition-all"
              title="Inspect Model 1 U-Net checkpoint & architecture"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
              Model 1 · 49.1% IoU
            </button>
          </div>

          <div className="flex items-center gap-8">
            <nav className="hidden items-center gap-7 md:flex">
              {LINKS.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </nav>
            <Button href="/try" size="md">
              Open the App →
            </Button>
          </div>
        </div>
      </header>

      <ModelStatusModal isOpen={showModelModal} onClose={() => setShowModelModal(false)} />
    </>
  );
}
