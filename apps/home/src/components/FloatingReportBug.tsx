import { useEffect, useMemo } from "react";
import { installSiteProblemReporting } from "@inshell/shared/problem-report";
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
  if (pathname === "/path") return "path_app";
  if (pathname === "/verify") return "verify";
  return "home";
}

export default function FloatingReportBug() {
  useEffect(() => installSiteProblemReporting(), []);
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
      href="https://github.com/inshell-art/inshell.art/issues/new"
      target={reportBugLink.target}
      rel={reportBugLink.rel}
      aria-label="Report a problem"
    >
      Report a problem
    </a>
  );
}
