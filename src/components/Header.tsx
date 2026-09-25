import { Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import logoUrl from "@/assets/almenara-vigia-logo.png";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { JOIN_BETA_URL } from "@/lib/beta";

const SHORTCUT_CLICKS = 4;
const SHORTCUT_WINDOW_MS = 1500;

/* Hidden way into /denunciar while reporting is beta-only: four quick taps on the logo. */
function useLogoShortcut() {
  const navigate = useNavigate();
  const clicks = useRef({ count: 0, last: 0 });

  return (event: React.MouseEvent) => {
    const now = Date.now();
    const state = clicks.current;
    state.count = now - state.last < SHORTCUT_WINDOW_MS ? state.count + 1 : 1;
    state.last = now;
    if (state.count < SHORTCUT_CLICKS) return;
    event.preventDefault();
    state.count = 0;
    void navigate({ to: "/denunciar" });
  };
}

export function Header() {
  const onLogoClick = useLogoShortcut();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" onClick={onLogoClick} className="flex min-w-0 items-center gap-3">
          <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
          <span className="truncate text-base font-extrabold tracking-tight text-foreground uppercase">
            Almenara Vigia
          </span>
        </Link>

        <a
          href={JOIN_BETA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-2 rounded-full bg-[#1f8f4e] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <WhatsAppIcon />
          <span className="sm:hidden">Quero participar</span>
          <span className="hidden sm:inline">Quero denunciar também</span>
        </a>
      </div>
    </header>
  );
}
