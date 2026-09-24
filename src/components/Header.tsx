import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/almenara-vigia-logo.png";

export function Header({ variant = "public" }: { variant?: "public" | "denuncias" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg" />
          <span className="text-base font-extrabold tracking-tight text-foreground uppercase">
            Almenara Vigia
          </span>
        </Link>

        {variant === "public" ? (
          <Link
            to="/denuncias"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ver denúncias
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Fazer denúncia
          </Link>
        )}
      </div>
    </header>
  );
}
