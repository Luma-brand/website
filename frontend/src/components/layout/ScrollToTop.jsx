import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      window.setTimeout(() => {
        const section = document.querySelector(hash);

        if (section) {
          const headerOffset = 105;
          const sectionTop = section.getBoundingClientRect().top + window.scrollY;
          const scrollToPosition = sectionTop - headerOffset;

          window.scrollTo({
            top: scrollToPosition,
            behavior: "smooth",
          });
        }
      }, 150);

      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname, hash]);

  return null;
}