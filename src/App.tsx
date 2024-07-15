import styles from "./App.module.css";
import { useState, useEffect, useRef } from "react";

const App = () => {
  const [projectOpacity, setProjectOpacity] = useState(0);
  const [yearOpacity, setYearOpacity] = useState(0);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const lastTimestamp = useRef(Date.now());

  console.log("projectOpacity", projectOpacity);

  // Handle any click event on the document
  useEffect(() => {
    const handleDocumentClick = () => {
      setProjectOpacity((prevOpacity) => Math.min(prevOpacity + 0.2, 1));
    };

    handleDocumentClick();

    document.addEventListener("click", handleDocumentClick);

    // Cleanup the event listener
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  // Decrease the opacity every second
  useEffect(() => {
    const interval = setInterval(() => {
      setProjectOpacity((prevOpacity) => Math.max(prevOpacity - 0.1, 0.1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const currentTimestamp = Date.now();
      let deltaTime = currentTimestamp - lastTimestamp.current;
      const distance = Math.sqrt(
        Math.pow(event.clientX - lastMousePosition.current.x, 2) +
          Math.pow(event.clientY - lastMousePosition.current.y, 2)
      );

      if (deltaTime === 0) {
        deltaTime = 1;
      }

      const speed = distance / deltaTime;
      console.log("deltaTime", deltaTime);
      const opacityIncrease = Math.min(speed * 0.05, 0.01);

      setProjectOpacity((prevOpacity) =>
        Math.min(prevOpacity + opacityIncrease, 1)
      );

      lastMousePosition.current = { x: event.clientX, y: event.clientY };
      lastTimestamp.current = currentTimestamp;
    };

    document.addEventListener("mousemove", handleMouseMove);

    // Cleanup the event listener
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Convert opacity for project to the opacity for year
  useEffect(() => {
    if (projectOpacity > 0.9) {
      setYearOpacity(projectOpacity);
    }
    if (projectOpacity <= 0.9) {
      setYearOpacity(Math.max(projectOpacity / 50, 0));
    }
  }, [projectOpacity]);

  return (
    <div
      className={styles.container}
      tabIndex={0}
      onKeyDown={(e) =>
        e.key &&
        setProjectOpacity((prevOpacity) => Math.min(prevOpacity + 0.1, 1))
      }
    >
      <div>
        <div className={styles.year} style={{ opacity: yearOpacity }}>
          In 2024
        </div>
        <div className={styles.project} style={{ opacity: projectOpacity }}>
          THOUGHT
        </div>
      </div>
      <div>
        <div className={styles.year} style={{ opacity: yearOpacity }}>
          {" "}
          In 2025
        </div>
        <div className={styles.project} style={{ opacity: projectOpacity }}>
          WILL
        </div>
      </div>
      <div>
        <div className={styles.year} style={{ opacity: yearOpacity }}>
          In 2026
        </div>
        <div className={styles.project} style={{ opacity: projectOpacity }}>
          AWA!
        </div>
      </div>
    </div>
  );
};

export default App;
