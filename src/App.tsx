import styles from "./App.module.css";
import { useState, useEffect } from "react";

const App = () => {
  const [opacity, setOpacity] = useState(0.1);
  const [reveal, setReveal] = useState(false);

  // Handle any click event on the document
  useEffect(() => {
    const handleDocumentClick = () => {
      setOpacity((prevOpacity) => Math.min(prevOpacity + 0.1, 1));
    };

    const handleKeyDown = () => {
      setOpacity((prevOpacity) => Math.min(prevOpacity + 0.1, 1));
    };

    handleDocumentClick();
    handleKeyDown();

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup the event listener
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Decrease the opacity every second
  useEffect(() => {
    const interval = setInterval(() => {
      setOpacity((prevOpacity) => Math.max(prevOpacity - 0.1, 0.1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reveal pops up when opcode over 0.9
  useEffect(() => {
    if (opacity > 0.9 && !reveal) {
      setReveal(true);
    }
    console.log("opacity", opacity);
  }, [opacity]);

  const handleAnimationEnd = () => {
    setReveal(false);
  };

  useEffect(() => {
    console.log("Reveal by handleAnimationEnd:", reveal);
  }, [reveal]);

  return (
    <div
      className={styles.container}
      tabIndex={0}
      onKeyDown={(e) =>
        e.key && setOpacity((prevOpacity) => Math.min(prevOpacity + 0.1, 1.0))
      }
    >
      <div>
        <div
          className={`${styles.year} ${reveal ? styles.animation : ""}`}
          onAnimationEnd={handleAnimationEnd}
        >
          In 2024
        </div>
        <div className={styles.project} style={{ opacity }}>
          THOUGHT
        </div>
      </div>
      <div>
        <div
          className={`${styles.year} ${reveal ? styles.animation : ""}`}
          onAnimationEnd={handleAnimationEnd}
        >
          In 2025
        </div>
        <div className={styles.project} style={{ opacity }}>
          WILL
        </div>
      </div>
      <div>
        <div
          className={`${styles.year} ${reveal ? styles.animation : ""}`}
          onAnimationEnd={handleAnimationEnd}
        >
          In 2026
        </div>
        <div className={styles.project} style={{ opacity }}>
          AWA!
        </div>
      </div>
    </div>
  );
};

export default App;
