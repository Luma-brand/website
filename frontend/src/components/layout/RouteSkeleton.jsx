import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PageSkeleton } from "./PageSkeleton";

export function RouteSkeleton() {
  const location = useLocation();
  const firstRender = useRef(true);
  const [isChangingPage, setIsChangingPage] = useState(false);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    setIsChangingPage(true);

    const timer = window.setTimeout(() => {
      setIsChangingPage(false);
    }, 420);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isChangingPage && (
        <motion.div
          className="route-skeleton-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <PageSkeleton />
        </motion.div>
      )}
    </AnimatePresence>
  );
}