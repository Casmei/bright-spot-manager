import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

/* WhatsApp first: it is how news travels in Almenara. */
export function ShareReport({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copie o link da denúncia:", url);
    }
  }

  return (
    <div className="grid gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-[#1f8f4e] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <WhatsAppIcon />
        Compartilhar no WhatsApp
      </a>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        {copied ? <Check className="h-4 w-4 text-[#1f8f4e]" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
