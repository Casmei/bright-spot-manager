const KEY = "almenara-vigia:contato";

export type SavedContact = { name: string; whatsapp: string };

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStore(): Store | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

/* Best effort: private windows and blocked storage throw, and the form must still work. */
export function loadContact(store = browserStore()): SavedContact | null {
  try {
    const saved: unknown = JSON.parse(store?.getItem(KEY) ?? "null");
    if (
      saved &&
      typeof saved === "object" &&
      typeof (saved as SavedContact).name === "string" &&
      typeof (saved as SavedContact).whatsapp === "string"
    ) {
      return { name: (saved as SavedContact).name, whatsapp: (saved as SavedContact).whatsapp };
    }
  } catch {
    // Unreadable or corrupt: start with empty fields
  }
  return null;
}

export function saveContact(contact: SavedContact, store = browserStore()) {
  try {
    store?.setItem(KEY, JSON.stringify(contact));
  } catch {
    // Storage full or blocked: the person just types it again next time
  }
}
