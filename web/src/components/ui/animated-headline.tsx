"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

// Rotating-word headline (adapted from the community "animated hero" pattern,
// re-themed: our display font, our gradient, no extra chrome). The static
// part stays put; the highlighted word springs through a masked slot.
export function AnimatedHeadline({
  prefix,
  words,
  className = "",
}: {
  prefix: string;
  words: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const list = useMemo(() => words, [words]);

  useEffect(() => {
    const id = setTimeout(() => setIndex((i) => (i === list.length - 1 ? 0 : i + 1)), 2200);
    return () => clearTimeout(id);
  }, [index, list]);

  return (
    <h1
      className={`font-semibold tracking-[-0.035em] text-[var(--ink)] ${className}`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {prefix}
      <span className="relative block h-[1.25em] overflow-hidden">
        {list.map((word, i) => (
          <motion.span
            key={word}
            className="absolute inset-x-0 bg-clip-text text-transparent bg-[linear-gradient(120deg,var(--accent)_0%,#c026d3_100%)]"
            initial={{ opacity: 0, y: "-100%" }}
            transition={{ type: "spring", stiffness: 60, damping: 14 }}
            animate={
              index === i
                ? { y: 0, opacity: 1 }
                : { y: index > i ? "-110%" : "110%", opacity: 0 }
            }
          >
            {word}
          </motion.span>
        ))}
      </span>
    </h1>
  );
}
