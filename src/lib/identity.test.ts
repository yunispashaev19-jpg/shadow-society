import { describe, expect, it } from "vitest";
import { nicknameChangeCost, sameNickname } from "./identity";

describe("player identity", () => {
  it("first name change is free", () => expect(nicknameChangeCost(0)).toBe(0));
  it("second name change costs 25000 coins", () => expect(nicknameChangeCost(1)).toBe(25000));
  it("later name changes cost 25000 coins", () => expect(nicknameChangeCost(4)).toBe(25000));
  it("nickname identity ignores case", () => {
    expect(sameNickname("Yunis", "yunis")).toBe(true);
    expect(sameNickname("Yunis", "Pashaev")).toBe(false);
  });
});