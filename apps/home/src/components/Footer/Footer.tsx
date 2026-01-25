import React, { useMemo } from "react";
import styles from "./Footer.module.css";

type FooterLink = {
  key: string;
  label: string;
  href: string;
  ariaLabel: string;
  tooltip?: string;
  squares?: string;
};

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
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

function resolvePublicUrl(
  names: string[],
  kind: "Telegram" | "Discord",
  validator: (value: string) => boolean
): string | null {
  const raw = readEnvUrl(names);
  if (!raw) {
    console.warn(`[footer] Missing ${kind} URL; hiding button.`);
    return null;
  }
  if (!isHttpsUrl(raw) || !validator(raw)) {
    console.warn(`[footer] Invalid ${kind} URL; hiding button.`);
    return null;
  }
  return raw;
}

const Footer: React.FC = () => {
  const telegramUrl = useMemo(
    () =>
      resolvePublicUrl(
        ["VITE_PUBLIC_TELEGRAM_CHANNEL_URL", "PUBLIC_TELEGRAM_CHANNEL_URL"],
        "Telegram",
        isTelegramUrl
      ),
    []
  );

  const links: FooterLink[] = [
    {
      key: "facets",
      label: "facets",
      href: "https://facets.inshell.art",
      ariaLabel: "Open facets",
    },
    {
      key: "hone",
      label: "hone",
      href: "https://hone.inshell.art",
      ariaLabel: "Open hone",
    },
    ...(telegramUrl
      ? ([
          {
            key: "telegram",
            label: "telegram",
            href: telegramUrl,
            ariaLabel: "Open Telegram announcements channel",
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
    },
    {
      key: "github",
      label: "github",
      href: "https://github.com/inshell-art",
      ariaLabel: "Open GitHub",
    },
  ];

  return (
    <footer className={styles.footer}>
      <ul className={styles.footerList}>
        {links.map((link) => (
          <li className={styles.footerItem} key={link.key}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-label={link.tooltip ?? link.label}
              aria-label={link.ariaLabel}
              className={styles.footerLink}
            >
              {renderSquares(link)}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
};

export default Footer;
