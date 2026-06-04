import React, { useMemo } from "react";
import styles from "./Footer.module.css";

type FooterLink = {
  key: string;
  label: string;
  href: string;
  ariaLabel: string;
  external?: boolean;
  tooltip?: string;
  squares?: string;
};

const INSHELL_GITHUB_URL = "https://github.com/inshell-art/";
const DEFAULT_TELEGRAM_URL = "https://t.me/inshell_art";
const DEFAULT_PUBLIC_FEED_RSS_URL = "https://inshell.art/rss.xml";

function getEnvValue(name: string): unknown {
  const runtimeEnv: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return runtimeEnv?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function readEnvUrl(names: string[]): string | null {
  for (const name of names) {
    const val = getEnvValue(name);
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function isHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value);
}

function isTelegramUrl(value: string): boolean {
  return /^https:\/\/t\.me\/[A-Za-z0-9_]{4,}\/?$/i.test(value);
}

function buildSquares(label: string): string {
  const len = Math.max(1, label.length);
  return "■".repeat(len);
}

function renderSquares(link: FooterLink): string {
  if (link.squares) return link.squares;
  return buildSquares(link.label);
}

function isPreviewDeployment(): boolean {
  const deployEnv = getEnvValue("VITE_DEPLOY_ENV");
  if (typeof deployEnv === "string" && deployEnv.trim().toLowerCase() === "preview") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "preview.inshell.art" || hostname.endsWith(".preview.inshell.art");
}

function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function defaultGalleryUrl(): string {
  if (isPreviewDeployment()) return "https://gallery.preview.inshell.art/";
  if (isLocalBrowserHost()) return "http://127.0.0.1:5174/gallery";
  return "https://gallery.inshell.art/";
}

function resolveGalleryUrl(): string {
  const direct = readEnvUrl(["VITE_GALLERY_URL", "VITE_THOUGHT_GALLERY_URL"]);
  if (direct) {
    try {
      return new globalThis.URL(direct).toString();
    } catch {
      return defaultGalleryUrl();
    }
  }

  return defaultGalleryUrl();
}

function resolvePublicFeedRssUrl(): string {
  const direct = readEnvUrl(["VITE_PUBLIC_FEED_RSS_URL", "PUBLIC_FEED_RSS_URL"]);
  if (direct && isHttpsUrl(direct)) return direct;
  return DEFAULT_PUBLIC_FEED_RSS_URL;
}

function resolvePublicUrl(
  names: string[],
  kind: "Telegram" | "Discord",
  validator: (value: string) => boolean,
  fallback?: string
): string | null {
  const raw = readEnvUrl(names) ?? fallback ?? null;
  const shouldWarn = getEnvValue("NODE_ENV") !== "test";
  if (!raw) {
    if (shouldWarn) console.warn(`[footer] Missing ${kind} URL; hiding button.`);
    return null;
  }
  if (!isHttpsUrl(raw) || !validator(raw)) {
    if (shouldWarn) console.warn(`[footer] Invalid ${kind} URL; hiding button.`);
    return null;
  }
  return raw;
}

const Footer: React.FC = () => {
  const galleryUrl = useMemo(() => resolveGalleryUrl(), []);
  const publicFeedRssUrl = useMemo(() => resolvePublicFeedRssUrl(), []);
  const telegramUrl = useMemo(
    () =>
      resolvePublicUrl(
        ["VITE_PUBLIC_TELEGRAM_CHANNEL_URL", "PUBLIC_TELEGRAM_CHANNEL_URL"],
        "Telegram",
        isTelegramUrl,
        DEFAULT_TELEGRAM_URL
      ),
    []
  );

  const links: FooterLink[] = [
    {
      key: "gallery",
      label: "gallery",
      href: galleryUrl,
      ariaLabel: "Open gallery",
      external: true,
      tooltip: "gallery",
    },
    {
      key: "pulse",
      label: "pulse",
      href: "/pulse",
      ariaLabel: "Open Pulse",
      external: true,
    },
    {
      key: "color-font",
      label: "color-font",
      href: "/color-font",
      ariaLabel: "Open color-font primitive page",
      external: true,
      tooltip: "color-font",
      squares: "■■■",
    },
    ...(telegramUrl
      ? ([
          {
            key: "telegram",
            label: "telegram",
            href: telegramUrl,
            ariaLabel: "Open Telegram announcements channel",
            external: true,
            tooltip: "telegram",
            squares: "■■",
          },
        ] as FooterLink[])
      : []),
    {
      key: "x",
      label: "X",
      href: "https://twitter.com/inshell_art",
      ariaLabel: "Open X",
      external: true,
    },
    {
      key: "github",
      label: "github",
      href: INSHELL_GITHUB_URL,
      ariaLabel: "Open GitHub",
      external: true,
    },
    {
      key: "rss",
      label: "rss",
      href: publicFeedRssUrl,
      ariaLabel: "Open Inshell Public Feed RSS",
      external: true,
      tooltip: "rss",
      squares: "■■■",
    },
  ];

  return (
    <footer className={styles.footer}>
      <nav className={styles.footerNav} aria-label="Project links">
        <ul className={styles.footerList}>
          {links.map((link) => (
            <li className={styles.footerItem} key={link.key}>
              <a
                href={link.href}
                target={link.external === false ? undefined : "_blank"}
                rel={link.external === false ? undefined : "noopener noreferrer"}
                data-label={link.tooltip ?? link.label}
                aria-label={link.ariaLabel}
                className={styles.footerLink}
              >
                {renderSquares(link)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
};

export default Footer;
