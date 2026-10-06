/**
 * Real-money coin packs via the owner's Stripe account. Coins are credited only
 * after the server re-reads the Checkout Session from Stripe and sees it paid;
 * each session credits at most once (coin_purchases primary key).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { findPack } from "./economy";

async function stripe(path: string, init?: { method?: string; body?: URLSearchParams }) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured yet.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(init?.body ? { body: init.body } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json["error"] as { message?: string } | undefined)?.message;
    console.error("Stripe error", res.status, msg);
    throw new Error("The payment service could not process this right now.");
  }
  return json;
}

export const createCoinCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { packId: string }) => z.object({ packId: z.string().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const pack = findPack(data.packId);
    if (!pack) throw new Error("Unknown coin pack.");
    const origin = getRequestHeader("origin") ?? "";
    if (!/^https?:\/\//.test(origin)) throw new Error("Could not start checkout.");

    const body = new URLSearchParams({
      mode: "payment",
      success_url: `${origin}/shop?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
      client_reference_id: context.userId,
      "metadata[user_id]": context.userId,
      "metadata[pack_id]": pack.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(pack.cents),
      "line_items[0][price_data][product_data][name]": `${pack.coins.toLocaleString("en-US")} coins`,
    });
    const session = await stripe("checkout/sessions", { method: "POST", body });
    return { url: session["url"] as string };
  });

export const confirmCoinPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string }) =>
    z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const session = await stripe(`checkout/sessions/${encodeURIComponent(data.sessionId)}`);
    const meta = (session["metadata"] ?? {}) as Record<string, string>;
    if (meta["user_id"] !== context.userId) throw new Error("This purchase belongs to another account.");
    if (session["payment_status"] !== "paid") return { status: "pending" as const, coins: 0 };
    const pack = findPack(meta["pack_id"] ?? "");
    if (!pack || session["amount_total"] !== pack.cents) throw new Error("Purchase details did not match.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credited, error } = await supabaseAdmin.rpc("credit_coin_purchase", {
      _session_id: data.sessionId,
      _user_id: context.userId,
      _pack_id: pack.id,
      _coins: pack.coins,
      _amount_cents: pack.cents,
    });
    if (error) throw new Error("Could not add your coins. Contact support with your receipt.");
    return { status: credited ? ("credited" as const) : ("already" as const), coins: pack.coins };
  });
