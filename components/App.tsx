"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import {
  DEFAULT_BRIEF,
  DEFAULT_DESIGN,
  DEFAULT_SETTINGS,
  FONTS,
  FORMATS,
  GOALS,
  THEMES,
  IMAGE_STYLES,
  LAYOUTS,
  PALETTES,
  TONES,
  imageStylePrompt,
  fontCss,
  pickPalette,
} from "@/lib/presets";
import { buildImagePrompt } from "@/lib/imagePrompt";
import { generateCarousel, generateImage as requestImage, generateTitleVariants } from "@/lib/openai";
import { loadProject, loadSettings, saveProject, saveSettings } from "@/lib/storage";
import type { Brief, Design, LayoutId, Project, Settings, Slide, SlideKind } from "@/lib/types";
import { SLIDE_H, SLIDE_W } from "@/lib/types";
import { ScaledSlide, SlideView, resolveLayout } from "./SlideView";
import { InstagramPreview } from "./InstagramPreview";

const uid = () => Math.random().toString(36).slice(2, 10);

const EMPTY_PROJECT: Project = {
  brief: DEFAULT_BRIEF,
  design: DEFAULT_DESIGN,
  slides: [],
  caption: "",
  hashtags: [],
};

function newSlide(kind: SlideKind = "content"): Slide {
  return { id: uid(), kind, eyebrow: "", title: "Новый слайд", body: "", imagePrompt: "", imageStatus: "idle" };
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

export default function App() {
  const [project, setProject] = useState<Project>(EMPTY_PROJECT);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"brief" | "design" | "caption">("brief");
  const [busyText, setBusyText] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoImages, setAutoImages] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [variants, setVariants] = useState<{ slideId: string; titles: string[]; loading: boolean } | null>(null);
  const [toast, setToast] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const slideRefs = useRef(new Map<string, HTMLDivElement>());
  const projectRef = useRef(project);
  projectRef.current = project;

  // --- загрузка / сохранение ---
  useEffect(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...loadSettings() });
    loadProject().then((p) => {
      if (p) {
        // незавершённые генерации после перезагрузки сбрасываем
        const slides = p.slides.map((s) => (s.imageStatus === "loading" ? { ...s, imageStatus: "idle" as const } : s));
        setProject({ ...EMPTY_PROJECT, ...p, brief: { ...DEFAULT_BRIEF, ...p.brief }, design: { ...DEFAULT_DESIGN, ...p.design }, slides });
        setSelectedId(slides[0]?.id ?? null);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveProject(project), 400);
    return () => clearTimeout(t);
  }, [project, loaded]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 9000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- обновления состояния ---
  const setBrief = (patch: Partial<Brief>) => setProject((p) => ({ ...p, brief: { ...p.brief, ...patch } }));
  const setDesign = (patch: Partial<Design>) => setProject((p) => ({ ...p, design: { ...p.design, ...patch } }));
  const updateSlide = useCallback(
    (id: string, patch: Partial<Slide>) =>
      setProject((p) => ({ ...p, slides: p.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [],
  );

  const fullPrompt = (slide: Slide, design: Design) =>
    buildImagePrompt(slide.imagePrompt || slide.title.replace(/\*\*/g, ""), imageStylePrompt(design), resolveLayout(slide, design));

  // --- генерация ---
  const generateImage = useCallback(
    async (id: string) => {
      const { slides, design } = projectRef.current;
      const slide = slides.find((s) => s.id === id);
      if (!slide) return;
      updateSlide(id, { imageStatus: "loading", imageError: undefined });
      try {
        const image = await requestImage(
          fullPrompt(slide, design),
          settings.apiKey,
          settings.imageModel,
          settings.imageQuality,
        );
        updateSlide(id, { image, imageStatus: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        updateSlide(id, { imageStatus: "error", imageError: msg });
        setToast({ kind: "error", text: msg });
      }
    },
    [settings, updateSlide],
  );

  const generateImages = useCallback(
    async (ids: string[]) => {
      // не больше 3 параллельных запросов — щадим rate limit
      const queue = [...ids];
      const worker = async () => {
        while (queue.length) await generateImage(queue.shift()!);
      };
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
    },
    [generateImage],
  );

  const needsImage = (s: Slide, d: Design) => resolveLayout(s, d) !== "minimal";

  async function generateText() {
    if (!project.brief.topic.trim()) {
      setToast({ kind: "error", text: "Сначала напишите тему карусели" });
      return;
    }
    if (!settings.apiKey.trim()) {
      setShowSettings(true);
      setToast({ kind: "error", text: "Вставьте API-ключ OpenAI, чтобы генерировать карусели" });
      return;
    }
    setBusyText(true);
    try {
      const data = await generateCarousel(project.brief, settings.apiKey, settings.textModel);
      const slides: Slide[] = data.slides.map((s) => ({ ...s, id: uid(), imageStatus: "idle" }));
      const next = { ...projectRef.current, slides, caption: data.caption, hashtags: data.hashtags };
      projectRef.current = next;
      setProject(next);
      setSelectedId(slides[0]?.id ?? null);
      if (autoImages) generateImages(slides.filter((s) => needsImage(s, next.design)).map((s) => s.id));
    } catch (e) {
      setToast({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyText(false);
    }
  }

  async function suggestTitles(slide: Slide) {
    if (!settings.apiKey.trim()) {
      setShowSettings(true);
      return;
    }
    setVariants({ slideId: slide.id, titles: [], loading: true });
    try {
      const { slides: all, brief: b } = projectRef.current;
      const titles = await generateTitleVariants(slide, all, b, settings.apiKey, settings.textModel);
      setVariants({ slideId: slide.id, titles, loading: false });
    } catch (e) {
      setVariants(null);
      setToast({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  // --- экспорт ---
  async function renderPng(id: string): Promise<string> {
    const node = slideRefs.current.get(id);
    if (!node) throw new Error("Слайд не найден");
    await document.fonts.ready;
    // Не переносим в клон вычисленные width/height: иначе блок с текстом сохраняет высоту из превью,
    // а в экспорте строки переносятся чуть иначе — появляются пустые полосы. Нужные размеры заданы inline.
    const includeStyleProperties = Array.from(getComputedStyle(document.documentElement)).filter(
      (p) => !["width", "height", "inline-size", "block-size"].includes(p),
    );
    const opts = { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, cacheBust: false, includeStyleProperties };
    // первый прогон прогревает шрифты/картинки (известная особенность html-to-image)
    await toPng(node, opts);
    return toPng(node, opts);
  }

  async function exportOne(id: string) {
    setExporting(true);
    try {
      const idx = project.slides.findIndex((s) => s.id === id);
      download(await renderPng(id), `slide-${String(idx + 1).padStart(2, "0")}.png`);
    } catch (e) {
      setToast({ kind: "error", text: `Экспорт не удался: ${e instanceof Error ? e.message : e}` });
    } finally {
      setExporting(false);
    }
  }

  async function exportAll() {
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const [i, s] of project.slides.entries()) {
        const url = await renderPng(s.id);
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, url.split(",")[1], { base64: true });
      }
      const caption = [project.caption, "", project.hashtags.map((h) => `#${h}`).join(" ")].join("\n");
      zip.file("caption.txt", caption);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      download(url, "carousel.zip");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setToast({ kind: "error", text: `Экспорт не удался: ${e instanceof Error ? e.message : e}` });
    } finally {
      setExporting(false);
    }
  }

  // --- операции со слайдами ---
  function moveSlide(id: string, dir: -1 | 1) {
    setProject((p) => {
      const i = p.slides.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.slides.length) return p;
      const slides = [...p.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...p, slides };
    });
  }
  function removeSlide(id: string) {
    setProject((p) => ({ ...p, slides: p.slides.filter((s) => s.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateSlide(id: string) {
    setProject((p) => {
      const i = p.slides.findIndex((s) => s.id === id);
      const copy = { ...p.slides[i], id: uid() };
      const slides = [...p.slides];
      slides.splice(i + 1, 0, copy);
      return { ...p, slides };
    });
  }
  function addSlide() {
    const s = newSlide();
    setProject((p) => {
      const slides = [...p.slides];
      const ctaIdx = slides.findIndex((x) => x.kind === "cta");
      slides.splice(ctaIdx >= 0 ? ctaIdx : slides.length, 0, s);
      return { ...p, slides };
    });
    setSelectedId(s.id);
  }
  function uploadImage(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => updateSlide(id, { image: String(reader.result), imageStatus: "done", imageError: undefined });
    reader.readAsDataURL(file);
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ kind: "info", text: `${what} скопирован` });
    } catch {
      setToast({ kind: "error", text: "Не удалось скопировать" });
    }
  }
  function resetProject() {
    if (!confirm("Начать новую карусель? Текущие слайды будут удалены.")) return;
    setProject((p) => ({ ...EMPTY_PROJECT, design: p.design }));
    setSelectedId(null);
  }
  function updateSettings(patch: Partial<Settings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }

  const { brief, design, slides } = project;
  const selected = slides.find((s) => s.id === selectedId) ?? null;
  const selectedIndex = selected ? slides.indexOf(selected) : -1;
  const loadingCount = slides.filter((s) => s.imageStatus === "loading").length;
  const missingImages = slides.filter((s) => needsImage(s, design) && !s.image && s.imageStatus !== "loading");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▦</span> Carousel Studio
        </div>
        <div className="topbar-actions">
          {loadingCount > 0 && <span className="pill pill--busy">Изображения: {loadingCount} в работе</span>}
          {slides.length > 0 && (
            <>
              <button className="btn" onClick={() => setShowPreview(true)}>
                ▶ Просмотр
              </button>
              <button className="btn btn--ghost" onClick={resetProject}>
                Новая
              </button>
              <button className="btn btn--primary" disabled={exporting} onClick={exportAll}>
                {exporting ? "Экспорт…" : "Скачать ZIP (PNG 1080×1350)"}
              </button>
            </>
          )}
          <button className="btn btn--icon" title="Настройки" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </header>

      <div className="layout">
        {/* ---------- Левая панель ---------- */}
        <aside className="panel panel--left">
          <div className="tabs">
            <button className={tab === "brief" ? "active" : ""} onClick={() => setTab("brief")}>
              Контент
            </button>
            <button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>
              Дизайн
            </button>
            <button className={tab === "caption" ? "active" : ""} onClick={() => setTab("caption")}>
              Подпись
            </button>
          </div>

          {tab === "brief" && (
            <div className="form">
              <label>
                Тема карусели *
                <textarea
                  rows={3}
                  placeholder="Напр.: 7 привычек, которые крадут вашу энергию по утрам"
                  value={brief.topic}
                  onChange={(e) => setBrief({ topic: e.target.value })}
                />
              </label>
              <label>
                Для кого
                <input
                  placeholder="Напр.: фрилансеры 25–35, работают из дома"
                  value={brief.audience}
                  onChange={(e) => setBrief({ audience: e.target.value })}
                />
              </label>
              <label>
                Формат
                <select value={brief.format} onChange={(e) => setBrief({ format: e.target.value })}>
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <label>
                  Цель
                  <select value={brief.goal} onChange={(e) => setBrief({ goal: e.target.value })}>
                    {GOALS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Тон
                  <select value={brief.tone} onChange={(e) => setBrief({ tone: e.target.value })}>
                    {TONES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="narrow">
                  Слайдов
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={brief.slideCount}
                    onChange={(e) => setBrief({ slideCount: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label>
                Язык
                <input value={brief.language} onChange={(e) => setBrief({ language: e.target.value })} />
              </label>
              <label>
                Пожелания
                <textarea
                  rows={2}
                  placeholder="Напр.: призыв — написать «ГАЙД» в директ; без англицизмов"
                  value={brief.extra}
                  onChange={(e) => setBrief({ extra: e.target.value })}
                />
              </label>
              <label className="check">
                <input type="checkbox" checked={autoImages} onChange={(e) => setAutoImages(e.target.checked)} />
                Сразу сгенерировать изображения
              </label>
              <button className="btn btn--primary btn--wide" disabled={busyText} onClick={generateText}>
                {busyText ? "Пишу тексты…" : slides.length ? "Перегенерировать карусель" : "Сгенерировать карусель"}
              </button>
              <p className="hint">
                Совет: 7–10 слайдов, хук на первом, одна мысль на слайд, призыв к действию на последнем. В заголовках
                **звёздочками** отмечаются акцентные слова.
              </p>
            </div>
          )}

          {tab === "design" && (
            <div className="form">
              <div className="field-title">Тема</div>
              <div className="themes">
                {THEMES.map((t) => {
                  const d = { ...design, ...t.design };
                  return (
                    <button
                      key={t.id}
                      className={`theme ${design.themeId === t.id ? "active" : ""}`}
                      style={{ background: d.bg, color: d.text }}
                      onClick={() => setDesign({ ...t.design, themeId: t.id })}
                    >
                      <span className="theme-aa" style={{ fontFamily: fontCss(d.headingFont) }}>
                        Аа<i style={{ color: d.accent }}>.</i>
                      </span>
                      <span className="theme-name" style={{ fontFamily: fontCss(d.bodyFont) }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="field-title">Палитра</div>
              <div className="palettes">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    title={p.label}
                    className={`swatch ${design.paletteId === p.id ? "active" : ""}`}
                    style={{ background: p.bg, color: p.text, borderColor: p.accent }}
                    onClick={() => setDesign({ paletteId: p.id, ...pickPalette(p.id) })}
                  >
                    <span style={{ background: p.accent }} />
                    Аа
                  </button>
                ))}
              </div>
              <div className="colors">
                {(["bg", "text", "muted", "accent"] as const).map((k) => (
                  <label key={k} className="color">
                    <input type="color" value={design[k]} onChange={(e) => setDesign({ [k]: e.target.value })} />
                    {{ bg: "Фон", text: "Текст", muted: "Второстеп.", accent: "Акцент" }[k]}
                  </label>
                ))}
              </div>

              <div className="row">
                <label>
                  Шрифт заголовков
                  <select value={design.headingFont} onChange={(e) => setDesign({ headingFont: e.target.value })}>
                    {FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Шрифт текста
                  <select value={design.bodyFont} onChange={(e) => setDesign({ bodyFont: e.target.value })}>
                    {FONTS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>
                  Выделение слов
                  <select
                    value={design.highlight}
                    onChange={(e) => setDesign({ highlight: e.target.value as Design["highlight"] })}
                  >
                    <option value="italic">Курсив + акцент</option>
                    <option value="color">Цветом</option>
                    <option value="marker">Маркером</option>
                  </select>
                </label>
                <label>
                  Выравнивание
                  <select
                    value={design.align}
                    onChange={(e) => setDesign({ align: e.target.value as Design["align"] })}
                  >
                    <option value="left">Слева</option>
                    <option value="center">По центру</option>
                  </select>
                </label>
              </div>
              <label>
                Размер заголовков: {Math.round(design.titleScale * 100)}%
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.05}
                  value={design.titleScale}
                  onChange={(e) => setDesign({ titleScale: Number(e.target.value) })}
                />
              </label>
              <label>
                Затемнение фото: {Math.round(design.overlay * 100)}%
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={design.overlay}
                  onChange={(e) => setDesign({ overlay: Number(e.target.value) })}
                />
              </label>

              <div className="field-title">Макеты</div>
              {(
                [
                  ["coverLayout", "Обложка"],
                  ["layout", "Слайды с контентом"],
                  ["ctaLayout", "Финальный слайд"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select value={design[key]} onChange={(e) => setDesign({ [key]: e.target.value as LayoutId })}>
                    {LAYOUTS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <div className="field-title">Стиль изображений</div>
              <select value={design.imageStyleId} onChange={(e) => setDesign({ imageStyleId: e.target.value })}>
                {IMAGE_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {design.imageStyleId === "custom" && (
                <textarea
                  rows={2}
                  placeholder="На английском: e.g. dreamy pastel film photo, soft pink light"
                  value={design.customImageStyle}
                  onChange={(e) => setDesign({ customImageStyle: e.target.value })}
                />
              )}

              <label className="check">
                <input
                  type="checkbox"
                  checked={design.matchImageColors}
                  onChange={(e) => setDesign({ matchImageColors: e.target.checked })}
                />
                Подгонять цвета картинок под палитру
              </label>

              <div className="field-title">Элементы</div>
              <label>
                Ник
                <input value={design.handle} onChange={(e) => setDesign({ handle: e.target.value })} />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={design.showCounter}
                  onChange={(e) => setDesign({ showCounter: e.target.checked })}
                />
                Номер слайда
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={design.showSwipe}
                  onChange={(e) => setDesign({ showSwipe: e.target.checked })}
                />
                Подсказка «листай» / «сохрани»
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={design.uppercaseTitles}
                  onChange={(e) => setDesign({ uppercaseTitles: e.target.checked })}
                />
                Заголовки капсом
              </label>
            </div>
          )}

          {tab === "caption" && (
            <div className="form">
              <label>
                Подпись к посту
                <textarea
                  rows={12}
                  value={project.caption}
                  onChange={(e) => setProject((p) => ({ ...p, caption: e.target.value }))}
                />
              </label>
              <label>
                Хэштеги
                <textarea
                  rows={3}
                  value={project.hashtags.map((h) => `#${h}`).join(" ")}
                  onChange={(e) =>
                    setProject((p) => ({
                      ...p,
                      hashtags: e.target.value
                        .split(/[\s,]+/)
                        .map((h) => h.replace(/^#/, ""))
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
              <button
                className="btn btn--wide"
                onClick={() =>
                  copy(`${project.caption}\n\n${project.hashtags.map((h) => `#${h}`).join(" ")}`, "Текст")
                }
              >
                Скопировать подпись
              </button>
              <p className="hint">Первые ~125 символов видны до «ещё» — там должен быть крючок.</p>
            </div>
          )}
        </aside>

        {/* ---------- Слайды ---------- */}
        <main className="canvas">
          {slides.length === 0 ? (
            <div className="empty">
              <h1>Карусели для Instagram за минуту</h1>
              <p>
                Опишите тему слева — нейросеть напишет цепляющие тексты по правилам вирусных каруселей и сгенерирует
                изображения в едином стиле через GPT Image (ChatGPT). Дальше можно править текст, шрифты, цвета и
                скачать готовые PNG 1080×1350.
              </p>
              <ol>
                <li>Хук на первом слайде — до 8 слов</li>
                <li>Одна мысль на слайд, 7–10 слайдов</li>
                <li>Формат 4:5 (1080×1350) — занимает больше места в ленте</li>
                <li>Последний слайд — призыв сохранить, поделиться или написать в директ</li>
              </ol>
            </div>
          ) : (
            <>
              <div className="canvas-bar">
                <span>
                  {slides.length} слайдов · 1080×1350
                </span>
                <div className="canvas-actions">
                  {missingImages.length > 0 && (
                    <button className="btn" onClick={() => generateImages(missingImages.map((s) => s.id))}>
                      Сгенерировать недостающие изображения ({missingImages.length})
                    </button>
                  )}
                  <button className="btn" onClick={addSlide}>
                    + Слайд
                  </button>
                </div>
              </div>
              <div className="grid">
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    className={`card ${s.id === selectedId ? "card--active" : ""}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <ScaledSlide width={300}>
                      <SlideView
                        ref={(el) => {
                          if (el) slideRefs.current.set(s.id, el);
                          else slideRefs.current.delete(s.id);
                        }}
                        slide={s}
                        index={i}
                        total={slides.length}
                        design={design}
                      />
                    </ScaledSlide>
                    {s.imageStatus === "loading" && <div className="card-spinner" />}
                    {s.imageStatus === "error" && <div className="card-error" title={s.imageError}>!</div>}
                    <div className="card-foot">
                      <span>
                        {i + 1}. {{ cover: "Обложка", content: "Контент", cta: "Призыв" }[s.kind]}
                      </span>
                      <span className="card-tools">
                        <button title="Влево" onClick={(e) => (e.stopPropagation(), moveSlide(s.id, -1))}>
                          ←
                        </button>
                        <button title="Вправо" onClick={(e) => (e.stopPropagation(), moveSlide(s.id, 1))}>
                          →
                        </button>
                        <button title="Скачать PNG" onClick={(e) => (e.stopPropagation(), exportOne(s.id))}>
                          ⤓
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ---------- Редактор слайда ---------- */}
        <aside className="panel panel--right">
          {!selected ? (
            <p className="hint">Выберите слайд, чтобы отредактировать текст и изображение.</p>
          ) : (
            <div className="form">
              <div className="field-title">
                Слайд {selectedIndex + 1} из {slides.length}
              </div>
              <div className="row">
                <label>
                  Тип
                  <select
                    value={selected.kind}
                    onChange={(e) => updateSlide(selected.id, { kind: e.target.value as SlideKind })}
                  >
                    <option value="cover">Обложка</option>
                    <option value="content">Контент</option>
                    <option value="cta">Призыв</option>
                  </select>
                </label>
                <label>
                  Макет
                  <select
                    value={selected.layout ?? ""}
                    onChange={(e) =>
                      updateSlide(selected.id, { layout: (e.target.value || undefined) as LayoutId | undefined })
                    }
                  >
                    <option value="">Как в дизайне</option>
                    {LAYOUTS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Надпись над заголовком
                <input value={selected.eyebrow} onChange={(e) => updateSlide(selected.id, { eyebrow: e.target.value })} />
              </label>
              <label>
                Заголовок <span className="muted">(**акцент**)</span>
                <textarea
                  rows={3}
                  value={selected.title}
                  onChange={(e) => updateSlide(selected.id, { title: e.target.value })}
                />
              </label>
              <button
                className="btn btn--ghost"
                disabled={variants?.slideId === selected.id && variants.loading}
                onClick={() => suggestTitles(selected)}
              >
                {variants?.slideId === selected.id && variants.loading
                  ? "Придумываю…"
                  : selected.kind === "cover"
                    ? "✨ 5 вариантов хука"
                    : "✨ 5 вариантов заголовка"}
              </button>
              {variants?.slideId === selected.id && variants.titles.length > 0 && (
                <div className="variants">
                  {variants.titles.map((t) => (
                    <button key={t} onClick={() => updateSlide(selected.id, { title: t })}>
                      {t.replace(/\*\*/g, "")}
                    </button>
                  ))}
                </div>
              )}
              <label>
                Текст
                <textarea
                  rows={5}
                  value={selected.body}
                  onChange={(e) => updateSlide(selected.id, { body: e.target.value })}
                />
              </label>

              <div className="field-title">Изображение</div>
              <label>
                Сцена (промпт, лучше на английском)
                <textarea
                  rows={4}
                  value={selected.imagePrompt}
                  onChange={(e) => updateSlide(selected.id, { imagePrompt: e.target.value })}
                />
              </label>
              <div className="btn-row">
                <button
                  className="btn btn--primary"
                  disabled={selected.imageStatus === "loading"}
                  onClick={() => generateImage(selected.id)}
                >
                  {selected.imageStatus === "loading"
                    ? "Генерирую…"
                    : selected.image
                      ? "Перегенерировать"
                      : "Сгенерировать"}
                </button>
                <label className="btn">
                  Загрузить
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(selected.id, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="btn-row">
                <button className="btn btn--ghost" onClick={() => copy(fullPrompt(selected, design), "Промпт")}>
                  Копировать промпт для ChatGPT
                </button>
                {selected.image && (
                  <button className="btn btn--ghost" onClick={() => updateSlide(selected.id, { image: undefined, imageStatus: "idle" })}>
                    Убрать
                  </button>
                )}
              </div>
              {selected.imageStatus === "error" && <p className="error">{selected.imageError}</p>}
              {selected.image && (
                <label>
                  Кадрирование по вертикали
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selected.imageFocus ?? 50}
                    onChange={(e) => updateSlide(selected.id, { imageFocus: Number(e.target.value) })}
                  />
                </label>
              )}

              <div className="field-title">Слайд</div>
              <div className="btn-row">
                <button className="btn" onClick={() => duplicateSlide(selected.id)}>
                  Дублировать
                </button>
                <button className="btn btn--danger" onClick={() => removeSlide(selected.id)}>
                  Удалить
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showSettings && (
        <div className="modal-bg" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Настройки OpenAI</h3>
            <div className="form">
              <label>
                API-ключ
                <input
                  type="password"
                  placeholder="sk-…"
                  value={settings.apiKey}
                  onChange={(e) => updateSettings({ apiKey: e.target.value })}
                />
              </label>
              <p className="hint">
                Ключ хранится только в этом браузере и отправляется напрямую в OpenAI. Создать ключ:{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  platform.openai.com/api-keys
                </a>
              </p>
              <label>
                Модель для текста
                <input
                  list="text-models"
                  value={settings.textModel}
                  onChange={(e) => updateSettings({ textModel: e.target.value })}
                />
                <datalist id="text-models">
                  <option value="gpt-5.5" />
                  <option value="gpt-5.4" />
                  <option value="gpt-5.4-mini" />
                  <option value="gpt-5-mini" />
                  <option value="gpt-4.1" />
                </datalist>
              </label>
              <label>
                Модель для изображений
                <input
                  list="image-models"
                  value={settings.imageModel}
                  onChange={(e) => updateSettings({ imageModel: e.target.value })}
                />
                <datalist id="image-models">
                  <option value="gpt-image-2" />
                  <option value="gpt-image-1.5" />
                  <option value="gpt-image-1" />
                  <option value="gpt-image-1-mini" />
                </datalist>
              </label>
              <label>
                Качество изображений
                <select
                  value={settings.imageQuality}
                  onChange={(e) => updateSettings({ imageQuality: e.target.value as Settings["imageQuality"] })}
                >
                  <option value="low">Низкое — быстро и дёшево (черновик)</option>
                  <option value="medium">Среднее</option>
                  <option value="high">Высокое</option>
                </select>
              </label>
              <button className="btn btn--primary btn--wide" onClick={() => setShowSettings(false)}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <InstagramPreview project={project} onClose={() => setShowPreview(false)} />
      )}

      {toast && (
        <div className={`toast toast--${toast.kind}`} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
