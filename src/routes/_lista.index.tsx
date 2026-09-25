import { createFileRoute } from "@tanstack/react-router";

/* The list itself lives in the _lista layout; "/" just opens no report on top of it. */
export const Route = createFileRoute("/_lista/")({
  component: () => null,
});
