"use client";

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fontCss } from "@/lib/presets";
import type { Design, LayoutId, Slide } from "@/lib/types";
import { SLIDE_H, SLIDE_W } from "@/lib/types";

export function resolveLayout(slide: Slide, design: Design): LayoutId {
  if (slide.layout) return slide.layout;
  if (slide.kind === "cover") return design.coverLayout;
  if (slide.kind === "cta") return design.ctaLayout;
  return design.layout;
}

/** Типографика: короткие слова (предлоги, союзы) не остаются висеть в конце строки */
function typograph(text: string): string {
  return text
    .replace(/(?<=^|[\s(«"])([а-яёa-z]{1,2})\s+/gi, "$1\u00A0")
    .replace(/\s+([—–])\s/g, "\u00A0$1 ")
    .replace(/(\d+)\s+(?=[^\s\d])/g, "$1\u00A0");
}

/** **слово** → выделение */
function rich(raw: string): ReactNode[] {
  const text = typograph(raw);
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <span key={i} className="hl">
        {part.slice(2, -2)}
      </span>
    ) : (
      part
    ),
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function titleSize(slide: Slide, layout: LayoutId, scale: number): number {
  const plain = slide.title.replace(/\*\*/g, "");
  let base = slide.kind === "cover" ? 112 : 84;
  if (layout === "split" || layout === "frame") base *= 0.82;
  const len = plain.length;
  const k = len > 90 ? 0.6 : len > 65 ? 0.7 : len > 45 ? 0.82 : len > 28 ? 0.92 : 1;
  return Math.round(base * k * scale);
}

interface Props {
  slide: Slide;
  index: number;
  total: number;
  design: Design;
}

export const SlideView = forwardRef<HTMLDivElement, Props>(function SlideView(
  { slide, index, total, design },
  ref,
) {
  const layout = resolveLayout(slide, design);
  const isLast = index === total - 1;

  // Автоподгонка: если текст не влезает в свою зону, уменьшаем кегль ступенями по 8%
  const [fit, setFit] = useState(1);
  const [numClash, setNumClash] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const fitKey = [
    slide.title, slide.body, slide.eyebrow, slide.kind, layout, design.titleScale,
    design.headingFont, design.bodyFont, design.uppercaseTitles, design.align, design.showCounter,
  ].join("|");
  useLayoutEffect(() => setFit(1), [fitKey]);
  useEffect(() => {
    document.fonts?.ready.then(() => setFit(1));
  }, []);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const text = root?.querySelector<HTMLElement>(".s-text");
    if (!root || !text) return;
    const top = text.offsetTop;
    const bottom = top + text.offsetHeight;
    const frameImg = root.querySelector<HTMLElement>(".s-frame-img");
    const overflow = top < 150 || bottom > SLIDE_H - 120 || (frameImg !== null && frameImg.offsetHeight < 420);
    if (overflow && fit > 0.5) setFit((f) => Math.round(f * 0.92 * 100) / 100);
    // крупная декоративная цифра не должна залезать под заголовок
    const clash = top < 330;
    if (clash !== numClash) setNumClash(clash);
  });

  const tSize = Math.round(titleSize(slide, layout, design.titleScale) * fit);
  const bodySize = Math.round((slide.kind === "cover" ? 38 : layout === "minimal" ? 40 : 36) * Math.max(fit, 0.75));

  const style = {
    width: SLIDE_W,
    height: SLIDE_H,
    "--bg": design.bg,
    "--surface": design.surface,
    "--text": design.text,
    "--muted": design.muted,
    "--accent": design.accent,
    "--heading": fontCss(design.headingFont),
    "--body": fontCss(design.bodyFont),
    "--title-size": `${tSize}px`,
    "--body-size": `${bodySize}px`,
    "--align": design.align,
  } as CSSProperties;

  const image = slide.image ? (
    <img
      className="s-img"
      src={slide.image}
      alt=""
      style={{ width: "100%", height: "100%", objectPosition: `50% ${slide.imageFocus ?? 50}%` }}
    />
  ) : (
    <div className="s-img s-img--empty">
      <span>{slide.imageStatus === "loading" ? "Генерирую изображение…" : "Нет изображения"}</span>
    </div>
  );

  const text = (
    <div className="s-text">
      {layout === "minimal" && slide.kind === "content" && <div className="s-rule" style={{ width: 96, height: 8 }} />}
      {slide.eyebrow && <div className="s-eyebrow">{slide.eyebrow}</div>}
      {slide.title && <h2 className="s-title">{rich(slide.title)}</h2>}
      {slide.body && <p className="s-body">{rich(slide.body)}</p>}
    </div>
  );

  const bigNumber =
    layout === "minimal" && slide.kind === "content" && !numClash ? (
      <div className="s-bignum">{String(index).padStart(2, "0")}</div>
    ) : null;

  return (
    <div
      ref={setRefs}
      className={[
        "slide",
        `slide--${layout}`,
        `slide--${slide.kind}`,
        `hl--${design.highlight}`,
        design.uppercaseTitles ? "slide--upper" : "",
        design.align === "center" ? "slide--center" : "",
      ].join(" ")}
      style={style}
    >
      {layout === "overlay" && (
        <>
          {image}
          <div
            className="s-shade"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(design.bg, design.overlay * 0.35)} 0%, ${hexToRgba(
                design.bg,
                0,
              )} 22%, ${hexToRgba(design.bg, design.overlay * 0.55)} 50%, ${hexToRgba(
                design.bg,
                Math.min(1, design.overlay * 1.3),
              )} 100%)`,
            }}
          />
          {text}
        </>
      )}

      {layout === "split" && (
        <>
          <div className="s-split-img" style={{ height: 740 }}>{image}</div>
          {text}
        </>
      )}

      {layout === "frame" && (
        <>
          {text}
          <div className="s-frame-img">{image}</div>
        </>
      )}

      {layout === "minimal" && (
        <>
          {bigNumber}
          {text}
        </>
      )}

      <div className="s-top">
        <span className="s-handle">{design.handle}</span>
        {design.showCounter && (
          <span className="s-counter">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {design.showSwipe && !isLast && (
        <div className="s-swipe">
          листай
          <svg width="44" height="20" viewBox="0 0 44 20" fill="none" aria-hidden>
            <path d="M0 10h40M32 2l8 8-8 8" stroke="currentColor" strokeWidth="2.5" />
          </svg>
        </div>
      )}
      {isLast && design.showSwipe && (
        <div className="s-swipe s-swipe--save">
          <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden>
            <path d="M2 2h22v26l-11-8-11 8z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
          сохрани
        </div>
      )}
    </div>
  );
});

/** Превью слайда, отмасштабированное под ширину контейнера */
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
