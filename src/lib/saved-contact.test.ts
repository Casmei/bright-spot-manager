import { describe, expect, it } from "vitest";
import { loadContact, saveContact } from "@/lib/saved-contact";

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe("saved contact", () => {
  it("round-trips name and WhatsApp", () => {
    const store = memoryStore();
    saveContact({ name: "Tiago Castro", whatsapp: "(33) 99916-6432" }, store);
    expect(loadContact(store)).toEqual({ name: "Tiago Castro", whatsapp: "(33) 99916-6432" });
  });

  it("is null when nothing was saved or the data is corrupt", () => {
    const store = memoryStore();
    expect(loadContact(store)).toBeNull();
    store.setItem("almenara-vigia:contato", "{not json");
    expect(loadContact(store)).toBeNull();
    store.setItem("almenara-vigia:contato", JSON.stringify({ name: 1 }));
    expect(loadContact(store)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadContact(blocked)).toBeNull();
    expect(() => saveContact({ name: "A", whatsapp: "1" }, blocked)).not.toThrow();
  });
});
