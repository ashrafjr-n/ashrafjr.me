'use client';

import { useProgress } from "@react-three/drei";
import gsap from "gsap";
import { useEffect, useRef } from "react";

import { useScrollStore } from "@stores";

/** The line leaves over the first 0.4 screens of scroll (of ScrollControls' 3). */
const OUT = 0.4 / 3;
/** How far it drifts up as it goes, in px. */
const DRIFT = 70;

/**
 * "Hi! I am ASHRAF." — kept from the previous site in place of the reference's
 * 3D title: fixed near the top (dead centre on phones), in Soria (matching
 * EXPLORE), fading and lifting as the scroll starts. It comes in with the
 * canvas once everything has loaded.
 */
const Intro = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const { progress } = useProgress();

  useEffect(() => {
    if (progress === 100) gsap.to(wrapRef.current, { opacity: 1, duration: 3, delay: 1 });
  }, [progress]);

  // Written straight to the style: the store changes every frame. Only the
  // drift, as a custom property — the transform itself is the breakpoint's
  // (globals.css), centred differently on phones.
  useEffect(() => useScrollStore.subscribe(({ scrollProgress }) => {
    const t = Math.min(scrollProgress / OUT, 1);
    if (!lineRef.current) return;
    lineRef.current.style.opacity = String(1 - t);
    lineRef.current.style.setProperty('--drift', `${-t * DRIFT}px`);
    // Letters and words draw together as it goes (spacing in globals.css).
    lineRef.current.style.setProperty('--spread', String(1 - t));
  }), []);

  return (
    <div ref={wrapRef} style={{ opacity: 0 }}>
      <p className="intro" ref={lineRef}>Hi! I am ASHRAF.</p>
    </div>
  );
};

export default Intro;
