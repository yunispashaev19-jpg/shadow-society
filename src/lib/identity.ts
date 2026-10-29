export const NICKNAME_CHANGE_COINS = 25_000;
export function nicknameChangeCost(changes: number): number {
  return changes === 0 ? 0 : NICKNAME_CHANGE_COINS;
}
export function sameNickname(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}