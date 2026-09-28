"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { SLIDE_W } from "@/lib/types";
import { ScaledSlide, SlideView } from "./SlideView";

// Сетка профиля показывает пост в 3:4 — от 4:5 обрезаются края по ширине
const GRID_CROP = ((SLIDE_W - 1350 * 0.75) / 2 / SLIDE_W) * 100;

export function InstagramPreview({ project, onClose }: { project: Project; onClose: () => void }) {
  const { slides, design } = project;
  const [i, setI] = useState(0);
  const [W, setW] = useState(400);
  useEffect(() => setW(Math.min(400, window.innerWidth - 32)), []);
  const [guides, setGuides] = useState(false);
  const [more, setMore] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), slides.length - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const handle = design.handle.replace(/^@/, "") || "your.handle";
  const caption = project.caption;
  const cut = caption.length > 125 && !more;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="ig" style={{ width: W }} onClick={(e) => e.stopPropagation()}>
        <div className="ig-head">
          <span className="ig-avatar" style={{ background: design.accent, color: design.bg }}>
            {handle[0]?.toUpperCase()}
          </span>
          <b>{handle}</b>
          <span className="ig-dots">•••</span>
        </div>

        <div
          className="ig-stage"
          style={{ width: W, height: W * 1.25 }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="ig-track" style={{ transform: `translateX(${-i * W}px)` }}>
            {slides.map((s, n) => (
              <div key={s.id} style={{ flex: `0 0 ${W}px` }}>
                <ScaledSlide width={W}>
                  <SlideView slide={s} index={n} total={slides.length} design={design} />
                </ScaledSlide>
              </div>
            ))}
          </div>
          {guides && (
            <div className="ig-guides">
              <div className="g-crop" style={{ left: `${GRID_CROP}%`, right: `${GRID_CROP}%` }}>
                <span>сетка профиля 3:4</span>
              </div>
              <div className="g-safe" />
            </div>
          )}
          <span className="ig-count">
            {i + 1}/{slides.length}
          </span>
          {i > 0 && (
            <button className="ig-arrow ig-arrow--l" onClick={() => go(-1)} aria-label="Назад">
              ‹
            </button>
          )}
          {i < slides.length - 1 && (
            <button className="ig-arrow ig-arrow--r" onClick={() => go(1)} aria-label="Вперёд">
              ›
            </button>
          )}
        </div>

        <div className="ig-actions">
          <span>♡</span>
          <span>💬</span>
          <span>➤</span>
          <div className="ig-pager">
            {slides.map((s, n) => (
              <i key={s.id} className={n === i ? "on" : ""} />
            ))}
          </div>
          <span>🔖</span>
        </div>

        <div className="ig-caption">
          <b>{handle}</b> {cut ? caption.slice(0, 125).trimEnd() + "… " : caption}
          {cut && (
            <button className="ig-more" onClick={() => setMore(true)}>
              ещё
            </button>
          )}
          {!cut && project.hashtags.length > 0 && (
            <div className="ig-tags">{project.hashtags.map((h) => `#${h}`).join(" ")}</div>
          )}
        </div>

        <div className="ig-foot">
          <label className="check">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />
            Безопасные зоны
          </label>
          <button className="btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
