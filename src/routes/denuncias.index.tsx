import { createFileRoute, redirect } from "@tanstack/react-router";

/* The list moved to "/"; old links to /denuncias keep working. */
export const Route = createFileRoute("/denuncias/")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
