import { cn } from "@/lib/utils";

const PALETTES: Record<string, string> = {
  ash: "from-[oklch(0.42_0.02_260)] to-[oklch(0.26_0.02_270)]",
  vela: "from-[oklch(0.55_0.13_255)] to-[oklch(0.3_0.09_270)]",
  corvus: "from-[oklch(0.45_0.1_300)] to-[oklch(0.26_0.06_290)]",
  juno: "from-[oklch(0.58_0.13_35)] to-[oklch(0.3_0.08_20)]",
  sable: "from-[oklch(0.5_0.14_160)] to-[oklch(0.26_0.07_180)]",
};

const FRAMES: Record<string, string> = {
  none: "ring-1 ring-border",
  slate: "ring-2 ring-[oklch(0.62_0.01_260)]",
  moonlit: "ring-2 ring-primary shadow-[0_0_18px_-4px_var(--primary)]",
  violet: "ring-2 ring-accent shadow-[0_0_22px_-4px_var(--accent)]",
};

export function PlayerAvatar({
  name,
  avatarKey = "ash",
  frameKey = "none",
  size = "md",
  dimmed = false,
  className,
}: {
  name: string;
  avatarKey?: string;
  frameKey?: string;
  size?: "sm" | "md" | "lg" | "xl";
  dimmed?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-11 text-sm",
    lg: "size-16 text-lg",
    xl: "size-24 text-2xl",
  } as const;

  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold tracking-wide text-foreground/90",
        PALETTES[avatarKey] ?? PALETTES.ash,
        FRAMES[frameKey] ?? FRAMES.none,
        sizes[size],
        dimmed && "opacity-40 grayscale",
        className,
      )}
    >
      {initials}
    </div>
  );
}
