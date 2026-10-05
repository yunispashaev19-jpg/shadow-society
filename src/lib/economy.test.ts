import { describe, expect, it } from "vitest";
import { COIN_PACKS, ENTRY_FEE_COINS, REWARDED_VIDEO_COINS, findPack } from "./economy";

describe("coin economy", () => {
  it("match entry costs 100 coins", () => expect(ENTRY_FEE_COINS).toBe(100));
  it("rewarded video grants 1450 coins", () => expect(REWARDED_VIDEO_COINS).toBe(1450));
  it("pack prices match the price list", () => {
    expect(COIN_PACKS.map((p) => [p.coins, p.cents])).toEqual([
      [10000, 100], [35000, 350], [110000, 1100], [385000, 3850], [1200000, 12000], [4150000, 41500],
    ]);
  });
  it("unknown packs are rejected", () => expect(findPack("pack_free")).toBeUndefined());
});
