import React from "react";
import styles from "./Footer.module.css";

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <ul className={styles.footerList}>
        <li className={styles.footerItem}>
          <a
            href="https://prime.inshell.art"
            target="_blank"
            rel="noopener noreferrer"
          >
            prime
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="https://twitter.com/inshell_art"
            target="_blank"
            rel="noopener noreferrer"
          >
            twitter
          </a>
        </li>
        <li className={styles.footerItem}>
          <a
            href="https://github.com/inshell-art"
            target="_blank"
            rel="noopener noreferrer"
          >
            github
          </a>
        </li>
      </ul>
    </footer>
  );
};

export default Footer;
