"use client";

import { useEffect, useState } from "react";

const WORDS = [
  "analyze",
  "monitor",
  "classify",
  "preserve",
  "restore",
  "forecast",
];

export default function TypewriterText({
  words = WORDS,
  typingSpeed = 90,
  deletingSpeed = 45,
  pauseMs = 1800,
  className,
}: {
  words?: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseMs?: number;
  className?: string;
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(words[0]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const currentWord = words[wordIndex % words.length];

    if (!isDeleting) {
      // Typing phase
      if (displayedText.length < currentWord.length) {
        timer = setTimeout(() => {
          setDisplayedText(currentWord.slice(0, displayedText.length + 1));
        }, typingSpeed);
      } else {
        // Finished typing word, pause before deleting
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, pauseMs);
      }
    } else {
      // Deleting phase
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(currentWord.slice(0, displayedText.length - 1));
        }, deletingSpeed);
      } else {
        // Finished deleting, move to next word
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % words.length);
      }
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseMs]);

  return (
    <span className={`inline-flex items-baseline ${className ?? ""}`}>
      <span>{displayedText}</span>
      <span
        className="inline-block w-[3px] sm:w-[4px] h-[0.8em] bg-foreground/80 ml-1.5 align-baseline animate-pulse"
        aria-hidden="true"
      />
    </span>
  );
}
