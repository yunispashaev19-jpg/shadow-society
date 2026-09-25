import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Mafia" },
      { name: "description", content: "Choose a new password for your Mafia account." },
      { property: "og:title", content: "Set a new password — Mafia" },
      { property: "og:description", content: "Choose a new password for your Mafia account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="hero-surface flex min-h-screen flex-col items-center justify-center px-4">
      <BrandMark className="mb-8" />
      <form onSubmit={onSubmit} className="panel w-full max-w-md space-y-4 p-6 sm:p-8">
        <h1 className="font-display text-3xl">New password</h1>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={busy} className="accent-surface w-full text-primary-foreground">
          Save password
        </Button>
      </form>
    </div>
  );
}
