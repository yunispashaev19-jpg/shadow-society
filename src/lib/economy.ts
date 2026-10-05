/** Shared, browser-safe coin economy constants. Prices are enforced on the server. */
export const ENTRY_FEE_COINS = 100;
export const REWARDED_VIDEO_COINS = 1450;

export type CoinPack = { id: string; coins: number; cents: number };

export const COIN_PACKS: readonly CoinPack[] = [
  { id: "pack_10k", coins: 10_000, cents: 100 },
  { id: "pack_35k", coins: 35_000, cents: 350 },
  { id: "pack_110k", coins: 110_000, cents: 1_100 },
  { id: "pack_385k", coins: 385_000, cents: 3_850 },
  { id: "pack_1200k", coins: 1_200_000, cents: 12_000 },
  { id: "pack_4150k", coins: 4_150_000, cents: 41_500 },
];

export function findPack(id: string): CoinPack | undefined {
  return COIN_PACKS.find((p) => p.id === id);
}
