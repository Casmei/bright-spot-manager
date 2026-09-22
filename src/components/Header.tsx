import { Link } from "@tanstack/react-router";
import logo from "@/assets/cemig-logo.png.asset.json";

export function Header({ variant = "public" }: { variant?: "public" | "interno" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Cemig" className="h-7 w-auto" />
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">
            Iluminação Pública
          </span>
        </Link>

        {variant === "public" ? (
          <Link
            to="/interno"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Visão interna Cemig
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Abrir nova solicitação
          </Link>
        )}
      </div>
    </header>
  );
}
