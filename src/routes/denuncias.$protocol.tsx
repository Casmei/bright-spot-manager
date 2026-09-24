import { createFileRoute, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { ReportDialog, ReportNotFoundDialog } from "@/components/ReportDialog";
import { reportTypes } from "@/lib/report-types";
import { formatReportedOn, shortAddress, waitingSentence } from "@/lib/reports";
import { siteOrigin } from "@/lib/site-origin";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /* Set when the report was opened from the list, so closing can just go back. */
    fromList?: boolean;
  }
}

/* The shareable page of one report: the list stays behind, the report opens on top. */
export const Route = createFileRoute("/denuncias/$protocol")({
  loader: async ({ params, parentMatchPromise }) => {
    const reports = (await parentMatchPromise).loaderData ?? [];
    const protocol = params.protocol.toUpperCase();
    const report = reports.find((item) => item.protocol === protocol) ?? null;
    const origin = siteOrigin();
    return { report, origin, url: `${origin}/denuncias/${protocol}` };
  },
  head: ({ loaderData }) => {
    const report = loaderData?.report;
    if (!loaderData || !report)
      return { meta: [{ title: "Denúncia não encontrada — Almenara Vigia" }] };
    const meta = reportTypes[report.type];
    const title = `${meta.emoji} ${meta.label} — ${shortAddress(report.address)}`;
    const description = `${waitingSentence(report)} Protocolo ${report.protocol}, registrado em ${formatReportedOn(report)}.`;
    const image = `${loaderData.origin}${report.photoUrl}`;
    return {
      meta: [
        { title: `${title} · Almenara Vigia` },
        { name: "description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "Almenara Vigia" },
        { property: "og:url", content: loaderData.url },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:alt", content: `Foto da denúncia: ${meta.label}` },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: loaderData.url }],
    };
  },
  component: ReportPage,
});

function ReportPage() {
  const { report, url } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const fromList = useLocation({ select: (location) => location.state.fromList === true });

  function close() {
    if (fromList) router.history.back();
    else void navigate({ to: "/denuncias", resetScroll: false });
  }

  if (!report) return <ReportNotFoundDialog onClose={close} />;
  return <ReportDialog report={report} url={url} onClose={close} />;
}
