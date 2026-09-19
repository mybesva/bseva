import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const SLIDE_MS = 8000;

/** Swap these sources to change the hero scene without touching Home copy. */
const SLIDES = [
  { kind: "image" as const, src: "/images/hero-bg.png" },
  { kind: "video" as const, src: "/videos/landing-1.mp4" },
  { kind: "video" as const, src: "/videos/landing-2.mp4" },
  { kind: "video" as const, src: "/videos/landing-3.mp4" },
];

export default function LandingHeroBackground() {
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    SLIDES.forEach((slide, i) => {
      if (slide.kind !== "video") return;
      const video = videoRefs.current[i];
      if (!video) return;
      if (i === index) {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index]);

  return (
    <>
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            i === index ? "opacity-100 z-[1]" : "opacity-0 z-0",
          )}
          aria-hidden={i !== index}
        >
          {slide.kind === "image" ? (
            <img src={slide.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={slide.src}
              className="h-full w-full object-cover"
              muted
              playsInline
              loop
              preload="metadata"
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 z-[2] bg-gradient-to-b from-sidebar/80 via-sidebar/65 to-background" />
    </>
  );
}
