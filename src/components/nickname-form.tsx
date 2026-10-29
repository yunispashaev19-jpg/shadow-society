import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateProfile } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { nicknameChangeCost } from "@/lib/identity";

export function NicknameForm() {
  const { profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const save = useServerFn(updateProfile);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!profile) return null;
  const cost = nicknameChangeCost(profile.nickname_changes);
  const disabled = busy || name.trim() === profile.username || name.trim().length < 3 || profile.coins < cost;
  async function submit() {
    setBusy(true);
    try {
      await save({ data: { username: name.trim() } });
      await refreshProfile();
      setName("");
      setConfirm(false);
      toast.success(t("identity.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally { setBusy(false); }
  }
  return <>
    <form onSubmit={(e) => { e.preventDefault(); if (!disabled) { if (cost) setConfirm(true); else void submit(); } }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="new-nickname">{t("identity.nickname")}</Label>
        <Input id="new-nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder={profile.username} minLength={3} maxLength={18} pattern="[a-zA-Z0-9_]{3,18}" autoComplete="nickname" required />
      </div>
      <Button type="submit" disabled={disabled}>{cost ? t("identity.price", { coins: cost.toLocaleString("en-US") }) : t("identity.free")}</Button>
    </form>
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("identity.confirmTitle")}</DialogTitle><DialogDescription>{t("identity.confirmBody", { coins: cost.toLocaleString("en-US") })}</DialogDescription></DialogHeader>
        <p className="break-all font-semibold">{name.trim()}</p>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>{t("common.cancel")}</Button><Button onClick={submit} disabled={disabled}>{t("identity.confirm", { coins: cost.toLocaleString("en-US") })}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}