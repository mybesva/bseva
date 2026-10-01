import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { LandingTestimonial } from "@/lib/landingConfig";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Testimonials carousel: CSS scroll-snap (native swipe on touch), arrow buttons and dots for
 * mouse / keyboard. The parent hides the whole section when there is no approved content.
 */
export default function LandingTestimonials({ items }: { items: LandingTestimonial[] }) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    let nearest = 0;
    let best = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - el.offsetLeft - el.scrollLeft);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync, items.length]);

  function scrollToCard(i: number) {
    const el = trackRef.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  function step(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    const w = (card?.offsetWidth ?? el.clientWidth) + 24;
    el.scrollBy({ left: dir * w, behavior: "smooth" });
  }

  if (!items.length) return null;

  return (
    <section aria-labelledby="lp-test-title" className="bg-background py-14 md:py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="lp-orange-ink text-xs font-bold uppercase tracking-[0.2em]">{t("lp.test.eyebrow")}</p>
          <h2
            id="lp-test-title"
            className="mt-2 text-balance font-display text-3xl font-bold leading-tight text-foreground md:text-4xl"
          >
            {t("lp.test.title")}
          </h2>
        </div>

        <div className="relative mt-10" role="region" aria-roledescription="carousel" aria-label={t("lp.test.title")}>
          <ul
            ref={trackRef}
            onScroll={sync}
            tabIndex={0}
            className="lp-swipe -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:mx-0 md:px-0"
          >
            {items.map((item, i) => (
              <li
                key={item.id}
                aria-roledescription="slide"
                aria-label={`${i + 1} / ${items.length}`}
                className="w-[86%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
              >
                <figure className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    {item.avatarUrl ? (
                      <img
                        src={item.avatarUrl}
                        alt=""
                        width={48}
                        height={48}
                        loading="lazy"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
                      >
                        {initials(item.name)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <figcaption className="truncate text-base font-bold text-foreground">{item.name}</figcaption>
                      <p className="truncate text-sm font-medium text-muted-foreground">{item.location}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-0.5" role="img" aria-label={t("lp.test.stars", { count: item.rating })}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star
                        key={s}
                        size={18}
                        aria-hidden
                        className={s < item.rating ? "fill-brand-orange text-brand-orange" : "text-border"}
                      />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-[0.9375rem] font-medium leading-relaxed text-foreground">
                    {item.quote}
                  </blockquote>
                </figure>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canPrev}
            aria-label={t("lp.test.prev")}
            className="absolute -left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 md:flex xl:-left-6"
          >
            <ChevronLeft size={22} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canNext}
            aria-label={t("lp.test.next")}
            className="absolute -right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 md:flex xl:-right-6"
          >
            <ChevronRight size={22} aria-hidden />
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={t("lp.test.goTo", { n: i + 1 })}
              aria-current={i === active}
              className="flex h-6 w-6 items-center justify-center focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block h-2.5 rounded-full transition-all",
                  i === active ? "w-6 bg-primary" : "w-2.5 bg-border",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
