import React from "react";
import styles from "./Footer.module.css";

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <ul className={styles.footerList}>
        <li className={styles.footerItem}>
          <a
            href="https://facets.inshell.art"
            target="_blank"
            rel="noopener noreferrer"
            data-label="facets"
            className={styles.footerLink}
          >
            ■■■■■■
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="https://hone.inshell.art"
            target="_blank"
            rel="noopener noreferrer"
            data-label="hone"
            className={styles.footerLink}
          >
            ■■■■
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="https://twitter.com/inshell_art"
            target="_blank"
            rel="noopener noreferrer"
            data-label="X"
            className={styles.footerLink}
          >
            ■
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="https://github.com/inshell-art"
            target="_blank"
            rel="noopener noreferrer"
            data-label="github"
            className={styles.footerLink}
          >
            ■■■■■■
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="/gallery/index.html"
            target="_blank"
            rel="noopener noreferrer"
            data-label="gallery"
            className={styles.footerLink}
          >
            ■■■■■■■
          </a>
        </li>
      </ul>
    </footer>
  );
};

export default Footer;
