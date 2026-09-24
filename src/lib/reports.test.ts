import { describe, expect, it } from "vitest";
import { affectedAriaLabel, affectedPeople, affectedSentence, shareMessage } from "@/lib/reports";

describe("affectedPeople", () => {
  it("pluralises", () => {
    expect(affectedPeople(0)).toBe("0 pessoas");
    expect(affectedPeople(1)).toBe("1 pessoa");
    expect(affectedPeople(12)).toBe("12 pessoas");
  });
});

describe("affectedAriaLabel", () => {
  it("names the action and the count", () => {
    expect(affectedAriaLabel(1)).toBe("Me afeta também, 1 pessoa afetada");
    expect(affectedAriaLabel(3)).toBe("Me afeta também, 3 pessoas afetadas");
  });
});

describe("affectedSentence", () => {
  it.each([
    [
      { count: 0, byMe: false },
      { lead: "", rest: "Seja o primeiro a dizer que isso te afeta." },
    ],
    [
      { count: 1, byMe: false },
      { lead: "1 pessoa", rest: " diz que isso a afeta." },
    ],
    [
      { count: 12, byMe: false },
      { lead: "12 pessoas", rest: " dizem que isso as afeta." },
    ],
    [
      { count: 1, byMe: true },
      { lead: "", rest: "Você marcou que isso te afeta." },
    ],
    [
      { count: 2, byMe: true },
      { lead: "Você e mais 1 pessoa", rest: " dizem que isso as afeta." },
    ],
    [
      { count: 12, byMe: true },
      { lead: "Você e mais 11 pessoas", rest: " dizem que isso as afeta." },
    ],
  ])("%j", (state, expected) => {
    expect(affectedSentence(state)).toEqual(expected);
  });
});

describe("shareMessage", () => {
  const report = {
    type: "buraco" as const,
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG, 39900-000, Brasil",
    createdAt: new Date().toISOString(),
  };

  it("leaves the count out below two people", () => {
    expect(shareMessage(report)).not.toContain("afeta");
    expect(shareMessage(report, 1)).not.toContain("afeta");
  });

  it("mentions two or more people before the call to action", () => {
    expect(shareMessage(report, 12)).toMatch(/12 pessoas dizem que isso as afeta\. Veja e cobre:$/);
  });
});
