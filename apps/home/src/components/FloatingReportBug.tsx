import { useMemo } from "react";
import { buildReportBugLink, shouldShowReportBug } from "@/config/publicLaunch";

function currentPagePath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function currentPageState(): string {
  if (typeof window === "undefined") return "home";
  const pathname = window.location.pathname.replace(/\/+$/, "");
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/color-font") return "color_font";
  if (pathname === "/path") return "path_tokens";
  if (pathname === "/verify") return "verify";
  return "home";
}

export default function FloatingReportBug() {
  const reportBugLink = useMemo(() => {
    if (!shouldShowReportBug()) return null;
    return buildReportBugLink({
      page: currentPagePath(),
      surface: "path",
      state: currentPageState(),
    });
  }, []);

  if (!reportBugLink) return null;

  return (
    <a
      className={`${reportBugLink.className} inshell-report-bug-link--floating`}
      href={reportBugLink.href}
      target={reportBugLink.target}
      rel={reportBugLink.rel}
      aria-label={reportBugLink.ariaLabel}
    >
      {reportBugLink.label}
    </a>
  );
}
