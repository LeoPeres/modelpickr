"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = { key: string; node: ReactNode };
const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Horizontal snap carousel: swipe, trackpad, mouse drag and arrow buttons.
 * Items animate when they are reordered (FLIP) or added, and `focusKey`
 * scrolls a newly added item into view.
 */
export function Carousel({
  items,
  label,
  focusKey,
  resetKey,
}: {
  items: Item[];
  label: string;
  focusKey?: string | null;
  /** Changing it scrolls back to the first item (e.g. a new ranking). */
  resetKey?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const positions = useRef(new Map<string, number>());
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ prev: false, next: false });
  // A new resetKey means "go back to the first item". Item elements are
  // keyed by it, so they are recreated instead of moved: browsers re-snap to
  // follow a moved snapped element, which would drag the track to the middle.
  const appliedReset = useRef(resetKey);

  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  // FLIP: animate from each item's previous offset to its new one.
  const order = items.map((i) => i.key).join("|");
  useLayoutEffect(() => {
    const previous = positions.current;
    const next = new Map<string, number>();
    const animate = !reducedMotion();
    let index = 0;
    for (const { key } of items) {
      const el = nodes.current.get(key);
      // Animate the card, never the snap item itself: browsers compute snap
      // positions from transformed boxes, so a moving item derails snapping.
      const card = el?.firstElementChild as HTMLElement | null;
      if (!el) continue;
      next.set(key, el.offsetLeft);
      if (!animate) continue;
      const before = previous.get(key);
      if (!card) continue;
      if (before === undefined)
        card.animate(
          [
            { opacity: 0, transform: "translateY(14px) scale(0.96)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 420,
            easing: ease,
            delay: previous.size ? 0 : index * 50,
            fill: "backwards",
          },
        );
      else if (Math.abs(before - el.offsetLeft) > 1)
        card.animate(
          [
            { transform: `translateX(${before - el.offsetLeft}px)` },
            { transform: "none" },
          ],
          { duration: 520, easing: ease },
        );
      index++;
    }
    positions.current = next;
    const container = track.current;
    if (container && resetKey !== appliedReset.current) {
      appliedReset.current = resetKey;
      container.scrollTo({ left: 0, behavior: animate ? "smooth" : "auto" });
    }
    updateEdges();
  }, [order, resetKey]);

  // Scroll to a newly added item once, not on every later reorder.
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!focusKey || focusKey === focused.current) {
      if (!focusKey) focused.current = null;
      return;
    }
    const el = nodes.current.get(focusKey);
    const container = track.current;
    if (!el || !container) return;
    focused.current = focusKey;
    const left = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
    container.scrollTo({
      left: Math.max(0, left),
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }, [focusKey, order]);

  function page(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }

  return (
    <div className="carousel" role="region" aria-label={label}>
      <div
        ref={track}
        className={`carousel-track ${edges.prev ? "fade-start" : ""} ${edges.next ? "fade-end" : ""}`}
        onScroll={updateEdges}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.button !== 0) return;
          drag.current = {
            x: e.clientX,
            left: e.currentTarget.scrollLeft,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (!d.moved && Math.abs(dx) < 5) return;
          if (!d.moved) {
            d.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            e.currentTarget.classList.add("is-dragging");
          }
          e.currentTarget.scrollLeft = d.left - dx;
        }}
        onPointerUp={(e) => {
          if (drag.current?.moved) {
            suppressClick.current = true;
            // The click (if any) fires before this timer; never let the flag
            // swallow a later, real click.
            setTimeout(() => (suppressClick.current = false), 0);
            e.currentTarget.classList.remove("is-dragging");
          }
          drag.current = null;
        }}
        onPointerCancel={(e) => {
          e.currentTarget.classList.remove("is-dragging");
          drag.current = null;
        }}
        onClickCapture={(e) => {
          // A drag that ends over a button must not count as a click.
          if (suppressClick.current) {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        {items.map(({ key, node }) => (
          <div
            key={`${resetKey ?? ""}|${key}`}
            className="carousel-item"
            ref={(el) => {
              if (el) nodes.current.set(key, el);
              else nodes.current.delete(key);
            }}
          >
            {node}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="carousel-arrow prev"
        aria-label="Anterior"
        hidden={!edges.prev}
        onClick={() => page(-1)}
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        className="carousel-arrow next"
        aria-label="Próximo"
        hidden={!edges.next}
        onClick={() => page(1)}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
