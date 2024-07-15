import React from "react";
import styles from "./Footer.module.css"; // Import the CSS module
import githubIcon from "./assets/icon-github.svg";
import xIcon from "./assets/icon-x.svg";

const Footer: React.FC = () => {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        textAlign: "right",
      }}
    >
      <a
        className={styles.link} // Apply styles from CSS module
        href="https://github.com/inshell-art"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={githubIcon} alt="GitHub" />
      </a>
      <a
        className={styles.link} // Apply styles from CSS module
        href="https://x.com/inshell_art"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={xIcon} alt="X" />
      </a>
    </footer>
  );
};

export default Footer;
