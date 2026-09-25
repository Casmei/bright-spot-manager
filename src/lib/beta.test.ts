import { describe, expect, it } from "vitest";
import { betaWhatsapps, isBetaWhatsapp } from "@/lib/beta";

describe("betaWhatsapps", () => {
  it("reads a comma-separated list in any format", () => {
    expect(
      betaWhatsapps({ BETA_WHATSAPPS: "(33) 99916-6432, +55 33 98888-7777 ,, 33977776666" }),
    ).toEqual(["33999166432", "33988887777", "33977776666"]);
  });

  it("is empty when the env is missing or blank", () => {
    expect(betaWhatsapps({})).toEqual([]);
    expect(betaWhatsapps({ BETA_WHATSAPPS: " , " })).toEqual([]);
  });
});

describe("isBetaWhatsapp", () => {
  const members = betaWhatsapps({ BETA_WHATSAPPS: "33999166432" });

  it.each([
    "(33)999166432",
    "(33) 99916-6432",
    "33 999166432",
    "+55 (33) 99916-6432",
    "5533999166432",
  ])("accepts %s", (whatsapp) => {
    expect(isBetaWhatsapp(whatsapp, members)).toBe(true);
  });

  it("refuses a number outside the list", () => {
    expect(isBetaWhatsapp("(33) 99999-0000", members)).toBe(false);
  });

  it("refuses everyone when the list is empty", () => {
    expect(isBetaWhatsapp("(33) 99916-6432", [])).toBe(false);
    expect(isBetaWhatsapp("", [])).toBe(false);
  });
});
