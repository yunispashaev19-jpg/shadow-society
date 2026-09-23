import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="accent-surface grid size-7 place-items-center rounded-md">
        <span className="size-2.5 rounded-full bg-background/80" />
      </span>
      <span className="font-display text-xl leading-none tracking-[0.22em]">MAFIA</span>
    </span>
  );
}
