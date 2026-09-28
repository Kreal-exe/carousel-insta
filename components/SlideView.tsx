"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fontCss } from "@/lib/presets";
import { parseSlide, type Block } from "@/lib/text";
import type { Design, Slide, Tone } from "@/lib/types";
import { SLIDE_H, SLIDE_W } from "@/lib/types";

// Предлоги, союзы и частицы, которые не должны оставаться в конце строки
const SHORT_WORDS =
  /(?<=^|[\s(«"])(в|во|к|ко|с|со|у|о|об|от|до|за|из|на|по|не|ни|и|а|но|да|или|для|без|при|про|над|под|что|как)\s+/gi;

/** Типографика: предлоги и союзы не висят в конце строки, числа не отрываются от слова */
function typograph(text: string): string {
  return text
    .replace(SHORT_WORDS, "$1\u00A0")
    .replace(/\s+([—–])\s/g, " $1 ")
    .replace(/(\d+)\s+(?=[^\s\d])/g, "$1 ");
}

/** **слова** → акцент */
function rich(raw: string): ReactNode[] {
  return typograph(raw)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <span key={i} className="hl">
          {part.slice(2, -2)}
        </span>
      ) : (
        part
      ),
    );
}

const plainLen = (s: string) => s.replace(/\*\*/g, "").length;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function renderBlock(b: Block, i: number) {
  switch (b.t) {
    case "h":
      return (
        <h2 key={i} className="s-h">
          {rich(b.text)}
        </h2>
      );
    case "p":
      return (
        <p key={i} className="s-p">
          {rich(b.text)}
        </p>
      );
    case "hr":
      return <div key={i} className="s-hr" style={{ width: 120, height: 2 }} />;
    case "quote":
      return (
        <div key={i} className="s-quote">
          {b.lines.map((l, j) => (
            <p key={j}>{rich(l)}</p>
          ))}
        </div>
      );
    case "box":
      return (
        <div key={i} className="s-box">
          {b.items.map((it, j) => (
            <p key={j} className={it.big ? "s-box-big" : "s-box-small"}>
              {rich(it.text)}
            </p>
          ))}
        </div>
      );
  }
}

interface Props {
  slide: Slide;
  index: number;
  total: number;
  tone: Tone;
  design: Design;
  /** Показывать подсказки в пустом слайде (только в редакторе, не в экспорте) */
  hints?: boolean;
}

export const SlideView = forwardRef<HTMLDivElement, Props>(function SlideView(
  { slide, index, total, tone, design, hints },
  ref,
) {
  const photo = Boolean(slide.image);
  const isLast = index === total - 1 && total > 1;
  const blocks = parseSlide(slide.text);
  const pal = design[tone];

  // Автоподгонка: если текст не помещается в свою зону — уменьшаем кегль ступенями
  const [fit, setFit] = useState(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const fitKey = [slide.text, photo, design.titleScale, design.bodyScale, design.headingFont, design.bodyFont, design.coverFont, design.coverUppercase].join("|");
  useLayoutEffect(() => setFit(1), [fitKey]);
  useEffect(() => {
    document.fonts?.ready.then(() => setFit(1));
  }, []);
  useLayoutEffect(() => {
    const zone = rootRef.current?.querySelector<HTMLElement>(".s-zone");
    const content = zone?.firstElementChild as HTMLElement | null;
    if (!zone || !content) return;
    if (content.offsetHeight > zone.offsetHeight && fit > 0.45) setFit((f) => Math.round(f * 0.92 * 100) / 100);
  });

  // Размер заголовка зависит от длины текста
  const hLen = blocks.filter((b) => b.t === "h").reduce((a, b) => a + plainLen((b as { text: string }).text), 0);
  const hBase = photo
    ? hLen > 70 ? 76 : hLen > 45 ? 88 : 100
    : hLen > 150 ? 58 : hLen > 90 ? 66 : 76;
  const pBase = photo ? 68 : 40;

  const style = {
    width: SLIDE_W,
    height: SLIDE_H,
    "--bg1": pal.bg1,
    "--bg2": pal.bg2,
    "--text": pal.text,
    "--muted": pal.muted,
    "--accent": pal.accent,
    "--line": hexToRgba(pal.accent, 0.55),
    "--box": tone === "dark" ? "rgba(255,255,255,0.075)" : "rgba(60,40,20,0.06)",
    "--heading": fontCss(design.headingFont),
    "--body": fontCss(design.bodyFont),
    "--cover": fontCss(design.coverFont),
    "--h-size": `${Math.round(hBase * design.titleScale * fit)}px`,
    "--p-size": `${Math.round(pBase * design.bodyScale * Math.max(fit, 0.7))}px`,
    // для фото — светлые тона тёмной палитры
    "--cover-sub": design.dark.text,
    "--cover-accent": design.dark.accent,
  } as CSSProperties;

  const empty = !slide.text.trim();

  return (
    <div
      ref={setRefs}
      className={[
        "slide",
        photo ? "slide--photo" : `slide--${tone}`,
        design.align === "center" ? "slide--center" : "",
        design.coverUppercase ? "slide--upper" : "",
      ].join(" ")}
      style={style}
    >
      {photo ? (
        <>
          <img
            className="s-img"
            src={slide.image}
            alt=""
            style={{ width: "100%", height: "100%", objectPosition: `50% ${slide.imageFocus ?? 30}%` }}
          />
          {design.haze && <div className="s-haze" />}
          <div
            className="s-shade"
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(14,10,8,${design.overlay * 0.55}) 68%, rgba(14,10,8,${design.overlay}) 100%)`,
            }}
          />
        </>
      ) : (
        <div className="s-bg" />
      )}

      <div className="s-zone">
        <div className="s-content">
          {empty && hints ? <p className="s-hint">Введите текст слайда слева</p> : blocks.map(renderBlock)}
        </div>
      </div>

      {design.showCounter && !photo && (
        <div className="s-counter">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      )}

      <div className={`s-foot ${isLast ? "s-foot--center" : ""}`}>
        <span className="s-handle">{design.handle}</span>
        {design.showArrow && !isLast && (
          <svg className="s-arrow" width="106" height="14" viewBox="0 0 106 14" fill="none" aria-hidden>
            <path d="M0 7h104M97 1l7 6-7 6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </div>
    </div>
  );
});

/** Превью слайда, отмасштабированное под заданную ширину */
export function ScaledSlide({ width, children }: { width: number; children: ReactNode }) {
  const scale = width / SLIDE_W;
  return (
    <div className="scaled" style={{ width, height: SLIDE_H * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: SLIDE_W, height: SLIDE_H }}>
        {children}
      </div>
    </div>
  );
}
