import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* Chrome may fire beforeinstallprompt before React mounts, so catch it as soon as this module loads. */
let earlyPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    earlyPrompt = event as BeforeInstallPromptEvent;
  });
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/* iPhone/iPad never fire beforeinstallprompt; there the only way is Share → Add to Home Screen.
   iPadOS reports itself as a Mac, so touch support tells them apart. */
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/* Chrome/Edge/Android: opens the browser's install prompt. iOS: shows how to add it by hand.
   Hidden when the app is already installed or the browser can't install it. */
export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isInstalled());
    setIos(isIos());
    setPromptEvent(earlyPrompt);

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!promptEvent && !ios)) return null;

  async function install() {
    if (!promptEvent) {
      setShowIosHelp(true);
      return;
    }
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    // The event can only be used once; Chrome fires a new one if the person dismissed it.
    earlyPrompt = null;
    setPromptEvent(null);
    if (outcome === "accepted") setInstalled(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary shadow-sm transition-opacity hover:opacity-90"
      >
        <Download className="h-4 w-4" />
        Instalar app
      </button>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar o Almenara Vigia</DialogTitle>
            <DialogDescription>
              No iPhone, o app é instalado pelo Safari em dois passos:
            </DialogDescription>
          </DialogHeader>
          <ol className="grid gap-3 text-sm text-foreground">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Toque em <strong>Compartilhar</strong> na barra do Safari.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Escolha <strong>Adicionar à Tela de Início</strong>.
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
