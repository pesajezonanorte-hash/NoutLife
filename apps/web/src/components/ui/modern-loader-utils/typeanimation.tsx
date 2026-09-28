"use client";

import { useEffect, useMemo, useState } from "react";

type AnimationSpeed = "slow" | "normal" | "fast" | number;

interface TypeAnimationProps {
  words: string[];
  typingSpeed?: AnimationSpeed;
  deletingSpeed?: AnimationSpeed;
  pauseDuration?: number;
  className?: string;
}

function toMilliseconds(speed: AnimationSpeed | undefined, fallback: number) {
  if (typeof speed === "number") return speed;
  if (speed === "fast") return 22;
  if (speed === "slow") return 62;
  return fallback;
}

export default function TypeAnimation({
  words,
  typingSpeed = "normal",
  deletingSpeed = "normal",
  pauseDuration = 2000,
  className,
}: TypeAnimationProps) {
  const safeWords = useMemo(() => (words.length ? words : [""]), [words]);
  const [wordIndex, setWordIndex] = useState(0);
  const [letterCount, setLetterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const activeWord = safeWords[wordIndex % safeWords.length];

  useEffect(() => {
    const isAtEnd = letterCount >= activeWord.length;
    const isAtStart = letterCount === 0;
    const delay = deleting
      ? toMilliseconds(deletingSpeed, 34)
      : isAtEnd
        ? pauseDuration
        : toMilliseconds(typingSpeed, 38);

    const timer = window.setTimeout(() => {
      if (isAtEnd && !deleting) {
        setDeleting(true);
      } else if (isAtStart && deleting) {
        setDeleting(false);
        setWordIndex((current) => (current + 1) % safeWords.length);
      } else {
        setLetterCount((current) => current + (deleting ? -1 : 1));
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [activeWord, deleting, deletingSpeed, letterCount, pauseDuration, safeWords.length, typingSpeed]);

  return <span className={className}>{activeWord.slice(0, letterCount)}</span>;
}
