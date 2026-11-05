"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeartItem {
  id: number;
  x: number;
  size: number;
  duration: number;
  emoji: string;
}

export default function HeartShower({ trigger }: { trigger: number }) {
  const [hearts, setHearts] = useState<HeartItem[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const emojis = ["??", "??", "??", "??", "??", "?", "??"];
    const newHearts: HeartItem[] = Array.from({ length: 14 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10,
      size: Math.random() * 20 + 20,
      duration: Math.random() * 1.5 + 1.5,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    }));

    setHearts((prev) => [...prev, ...newHearts]);

    const timer = setTimeout(() => {
      setHearts([]);
    }, 3200);

    return () => clearTimeout(timer);
  }, [trigger]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 1, y: "100vh", x: `${h.x}vw`, scale: 0.5 }}
            animate={{
              opacity: [1, 1, 0],
              y: "-10vh",
              x: `${h.x + (Math.random() * 10 - 5)}vw`,
              scale: [0.5, 1.2, 1],
              rotate: [0, Math.random() * 40 - 20],
            }}
            transition={{ duration: h.duration, ease: "easeOut" }}
            style={{ fontSize: `${h.size}px` }}
            className="absolute bottom-0"
          >
            {h.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
