"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import { DEFAULT_DESIGN, DEFAULT_SETTINGS, FONTS, IMAGE_STYLES, THEMES, imageStylePrompt } from "@/lib/presets";
import { buildImagePrompt } from "@/lib/imagePrompt";
import { generateCarousel, generateImage as requestImage } from "@/lib/openai";
import { imagesTaskPrompt, openInChatGPT, sortImageFiles, textTaskPrompt } from "@/lib/chatgpt";
import { loadProject, loadSettings, saveProject, saveSettings } from "@/lib/storage";
import {
  SAMPLE_SLIDES,
  autoSplit,
  emptySlide,
  paragraphsToSlides,
  plainPreview,
  slidesToText,
  textToSlides,
} from "@/lib/text";
import type { Design, Palette, Project, Settings, Slide, Tone } from "@/lib/types";
import { MAX_SLIDES, SLIDE_H, SLIDE_W, toneOf } from "@/lib/types";
import { ScaledSlide, SlideView } from "./SlideView";
import { InstagramPreview } from "./InstagramPreview";

const newProject = (): Project => ({
  // последний слайд примера — тёмный, как в референсе
  slides: SAMPLE_SLIDES.map((t, i) => (i === SAMPLE_SLIDES.length - 1 ? { ...emptySlide(t), tone: "dark" as const } : emptySlide(t))),
  design: DEFAULT_DESIGN,
  caption: "",
  topic: "",
});

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

type Edit = { value: string; start: number; end: number };

/** Добавляет или убирает префикс у выделенных строк */
function prefixLines({ value, start, end }: Edit, prefix: string): Edit {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const toIdx = value.indexOf("\n", Math.max(end - 1, start));
  const to = toIdx === -1 ? value.length : toIdx;
  const lines = value.slice(from, to).split("\n");
  const all = lines.every((l) => l.startsWith(prefix));
  const changed = lines.map((l) => (all ? l.slice(prefix.length) : l.startsWith(prefix) ? l : prefix + l)).join("\n");
  return { value: value.slice(0, from) + changed + value.slice(to), start: from, end: from + changed.length };
}

/** Кнопки разметки над полем текста */
const MARKUP: Array<{ id: string; label: string; title: string; apply: (e: Edit) => Edit }> = [
  {
    id: "accent",
    label: "Акцент",
    title: "Выделить: в заголовке — цветом, в тексте — жирным (**слова**)",
    apply: ({ value, start, end }) => {
      const sel = value.slice(start, end);
      if (sel.length >= 4 && sel.startsWith("**") && sel.endsWith("**")) {
        const inner = sel.slice(2, -2);
        return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
      }
      return { value: value.slice(0, start) + "**" + sel + "**" + value.slice(end), start: start + 2, end: end + 2 };
    },
  },
  { id: "h", label: "Заголовок", title: "Сделать строку крупным заголовком (# в начале строки)", apply: (e) => prefixLines(e, "# ") },
  {
    id: "hr",
    label: "Линия",
    title: "Тонкая линия-разделитель (---)",
    apply: ({ value, end }) => {
      const nl = value.indexOf("\n", end);
      const lineEnd = nl === -1 ? value.length : nl;
      const next = value.slice(0, lineEnd) + "\n---\n" + value.slice(lineEnd);
      return { value: next, start: lineEnd + 5, end: lineEnd + 5 };
    },
  },
  { id: "box", label: "Плашка", title: "Текст на плашке (! в начале строки; «! #» — крупно)", apply: (e) => prefixLines(e, "! ") },
  { id: "quote", label: "Цитата", title: "Цитата с вертикальной линией (> в начале строки)", apply: (e) => prefixLines(e, "> ") },
];

export default function App() {
  const [project, setProject] = useState<Project>(newProject);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string>("");
  const [mode, setMode] = useState<"slides" | "text">("slides");
  const [bigText, setBigText] = useState("");
  const [splitCount, setSplitCount] = useState(8);
  const [tab, setTab] = useState<"style" | "colors">("style");
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [stageW, setStageW] = useState(480);

  const thumbRefs = useRef(new Map<string, HTMLDivElement>());
  const areaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const stageRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const { slides, design } = project;
  const activeIndex = Math.max(0, slides.findIndex((s) => s.id === activeId));
  const active = slides[activeIndex];

  // --- загрузка / сохранение ---
  useEffect(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...loadSettings() });
    loadProject().then((p) => {
      const valid =
        p && Array.isArray(p.slides) && p.slides.length > 0 && p.slides.every((s) => typeof s.text === "string") && p.design?.light;
      if (valid) {
        const restored = p.slides.map((s) => (s.imageStatus === "loading" ? { ...s, imageStatus: undefined } : s));
        setProject({ ...newProject(), ...p, design: { ...DEFAULT_DESIGN, ...p.design }, slides: restored });
        setActiveId(restored[0].id);
      } else {
        setActiveId(projectRef.current.slides[0].id);
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
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 9000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // большое превью занимает всё свободное место
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const byHeight = ((r.height - 8) * SLIDE_W) / SLIDE_H;
      setStageW(Math.round(Math.max(240, Math.min(r.width - 96, byHeight, 640))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- изменения ---
  const setSlides = useCallback((fn: (s: Slide[]) => Slide[]) => setProject((p) => ({ ...p, slides: fn(p.slides) })), []);
  const updateSlide = useCallback(
    (id: string, patch: Partial<Slide>) => setSlides((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    [setSlides],
  );
  const setDesign = (patch: Partial<Design>) => setProject((p) => ({ ...p, design: { ...p.design, ...patch } }));
  const setPalette = (tone: Tone, patch: Partial<Palette>) =>
    setProject((p) => ({ ...p, design: { ...p.design, [tone]: { ...p.design[tone], ...patch } } }));

  function select(id: string, scrollEditor = true) {
    setActiveId(id);
    if (scrollEditor) cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function applyMarkup(id: string, op: (e: Edit) => Edit) {
    const el = areaRefs.current.get(id);
    const slide = projectRef.current.slides.find((s) => s.id === id);
    if (!slide) return;
    const len = slide.text.length;
    const res = op({ value: slide.text, start: el?.selectionStart ?? len, end: el?.selectionEnd ?? len });
    updateSlide(id, { text: res.value });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(res.start, res.end);
    });
  }

  function addSlide() {
    if (slides.length >= MAX_SLIDES) {
      setToast({ kind: "error", text: `В Instagram максимум ${MAX_SLIDES} слайдов` });
      return;
    }
    const s = emptySlide();
    setSlides((all) => {
      const next = [...all];
      next.splice(activeIndex + 1, 0, s);
      return next;
    });
    setActiveId(s.id);
    if (mode === "slides") requestAnimationFrame(() => areaRefs.current.get(s.id)?.focus());
  }
  function removeSlide(id: string) {
    if (slides.length <= 1) return;
    const i = slides.findIndex((s) => s.id === id);
    setSlides((all) => all.filter((s) => s.id !== id));
    if (id === active?.id) setActiveId((slides[i + 1] ?? slides[i - 1]).id);
  }
  function moveSlide(id: string, dir: -1 | 1) {
    setSlides((all) => {
      const i = all.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= all.length) return all;
      const next = [...all];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function cycleTone(s: Slide) {
    const order: Array<Tone | undefined> = [undefined, "light", "dark"];
    updateSlide(s.id, { tone: order[(order.indexOf(s.tone) + 1) % order.length] });
  }
  function setImage(id: string, file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => updateSlide(id, { image: String(reader.result), imageStatus: undefined, imageError: undefined });
    reader.readAsDataURL(file);
  }
  const dropImage = (id: string) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      const f = e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      setImage(id, f);
    },
  });

  // --- режим «одним текстом» ---
  function switchMode(m: "slides" | "text") {
    if (m === "text") setBigText(slidesToText(projectRef.current.slides));
    setMode(m);
  }
  function onBigText(v: string) {
    setBigText(v);
    setSlides((prev) => {
      const next = textToSlides(v, prev);
      return next.length ? next : [emptySlide()];
    });
  }
  function applySplit(next: Slide[]) {
    if (!next.length) return;
    setSlides(() => next);
    setBigText(slidesToText(next));
    setActiveId(next[0].id);
    setToast({ kind: "info", text: `Готово: ${next.length} слайдов` });
  }

  // --- ChatGPT / API ---
  async function openChat(prompt: string, what: string) {
    const how = await openInChatGPT(prompt);
    setToast({
      kind: "info",
      text:
        how === "prefilled"
          ? `${what}: ChatGPT открыт в новой вкладке. Задание также скопировано — если поле пустое, нажмите Ctrl+V.`
          : `${what}: задание скопировано — вставьте его в ChatGPT (Ctrl+V).`,
    });
  }
  async function pasteAnswer() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty");
      const prev = projectRef.current.slides;
      applySplit(/^\s*={3,}\s*$/m.test(text) ? textToSlides(text, prev) : paragraphsToSlides(text, prev));
      setMode("text");
    } catch {
      switchMode("text");
      setToast({ kind: "info", text: "Вставьте ответ ChatGPT в большое поле (Ctrl+V)." });
    }
  }
  async function generateWithApi() {
    if (!project.topic.trim()) {
      setToast({ kind: "error", text: "Напишите тему" });
      return;
    }
    setBusy(true);
    try {
      const res = await generateCarousel(project.topic, splitCount, settings.apiKey, settings.textModel);
      const prev = projectRef.current.slides;
      applySplit(res.slides.map((s, i) => ({ ...(prev[i] ?? emptySlide()), text: s.body ? `${s.title}\n\n${s.body}` : s.title })));
      setProject((p) => ({ ...p, caption: res.caption }));
    } catch (e) {
      setToast({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }
  const imagePromptFor = (s: Slide) =>
    buildImagePrompt(
      `Photo for an Instagram carousel slide about: "${plainPreview(s.text)}"`,
      imageStylePrompt(design),
      "overlay",
    );
  async function generatePhoto(id: string) {
    const s = projectRef.current.slides.find((x) => x.id === id);
    if (!s) return;
    updateSlide(id, { imageStatus: "loading", imageError: undefined });
    try {
      const image = await requestImage(imagePromptFor(s), settings.apiKey, settings.imageModel, settings.imageQuality);
      updateSlide(id, { image, imageStatus: undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      updateSlide(id, { imageStatus: "error", imageError: msg });
      setToast({ kind: "error", text: msg });
    }
  }

  // --- экспорт ---
  async function renderPng(id: string): Promise<string> {
    const node = thumbRefs.current.get(id);
    if (!node) throw new Error("Слайд не найден");
    await document.fonts.ready;
    // вычисленные width/height в клон не переносим — иначе блоки текста «замерзают» на размерах превью
    const includeStyleProperties = Array.from(getComputedStyle(document.documentElement)).filter(
      (p) => !["width", "height", "inline-size", "block-size"].includes(p),
    );
    const opts = { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, cacheBust: false, includeStyleProperties };
    await toPng(node, opts); // прогрев шрифтов и картинок
    return toPng(node, opts);
  }
  async function exportOne() {
    setExporting(true);
    try {
      download(await renderPng(active.id), `slide-${String(activeIndex + 1).padStart(2, "0")}.png`);
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
      for (const [i, s] of slides.entries()) {
        const url = await renderPng(s.id);
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, url.split(",")[1], { base64: true });
      }
      if (project.caption.trim()) zip.file("caption.txt", project.caption);
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

  function updateSettings(patch: Partial<Settings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }
  function loadSample() {
    if (!confirm("Заменить текст примером? Фото и оформление сохранятся.")) return;
    const next = SAMPLE_SLIDES.map((t, i) => ({ ...(slides[i] ?? emptySlide()), text: t }));
    setSlides(() => next);
    setActiveId(next[0].id);
    setBigText(slidesToText(next));
  }
  function clearAll() {
    if (!confirm("Очистить все слайды?")) return;
    const blank = Array.from({ length: 5 }, () => emptySlide());
    setSlides(() => blank);
    setActiveId(blank[0].id);
    setBigText(slidesToText(blank));
  }

  const hasKey = Boolean(settings.apiKey.trim());
  const toneLabel = (s: Slide, i: number) => {
    if (s.image) return "фото";
    const name = toneOf(slides, i, design) === "light" ? "светлый" : "тёмный";
    return s.tone ? name : `${name} · авто`;
  };
  const fontOptions = FONTS.map((f) => (
    <option key={f.id} value={f.id}>
      {f.label}
    </option>
  ));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">▦</span> Carousel Studio
        </div>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setShowPreview(true)}>
            ▶ Как в Instagram
          </button>
          <button className="btn btn--primary" disabled={exporting} onClick={exportAll}>
            {exporting ? "Экспорт…" : `Скачать все (${slides.length} PNG)`}
          </button>
          <button className="btn btn--icon" title="Настройки API" onClick={() => setShowSettings(true)}>
            ⚙
          </button>
        </div>
      </header>

      <div className="layout">
        {/* ================= Текст ================= */}
        <aside className="panel panel--left">
          <div className="tabs">
            <button className={mode === "slides" ? "active" : ""} onClick={() => switchMode("slides")}>
              По слайдам
            </button>
            <button className={mode === "text" ? "active" : ""} onClick={() => switchMode("text")}>
              Одним текстом
            </button>
          </div>

          {mode === "slides" ? (
            <div className="cards">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(s.id, el);
                    else cardRefs.current.delete(s.id);
                  }}
                  className={`tcard ${s.id === active?.id ? "tcard--active" : ""}`}
                  onClick={() => setActiveId(s.id)}
                  {...dropImage(s.id)}
                >
                  <div className="tcard-head">
                    <span className="tcard-num">{String(i + 1).padStart(2, "0")}</span>
                    <button className="chip" title="Фон: авто / светлый / тёмный" onClick={() => cycleTone(s)} disabled={!!s.image}>
                      {toneLabel(s, i)}
                    </button>
                    <span className="grow" />
                    <button className="icon" title="Выше" onClick={() => moveSlide(s.id, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button className="icon" title="Ниже" onClick={() => moveSlide(s.id, 1)} disabled={i === slides.length - 1}>
                      ↓
                    </button>
                    <button className="icon" title="Удалить слайд" onClick={() => removeSlide(s.id)} disabled={slides.length <= 1}>
                      ✕
                    </button>
                  </div>

                  {s.id === active?.id && (
                    <div className="markup">
                      {MARKUP.map((m) => (
                        <button
                          key={m.id}
                          title={m.title}
                          className={`mk mk--${m.id}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyMarkup(s.id, m.apply)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <textarea
                    ref={(el) => {
                      if (el) areaRefs.current.set(s.id, el);
                      else areaRefs.current.delete(s.id);
                    }}
                    className="tarea"
                    rows={Math.min(12, Math.max(3, s.text.split("\n").length + 1))}
                    placeholder={i === 0 ? "Заголовок обложки\nи подпись под ним" : "Заголовок слайда\n\nТекст под заголовком"}
                    value={s.text}
                    onFocus={() => select(s.id, false)}
                    onChange={(e) => updateSlide(s.id, { text: e.target.value })}
                  />

                  <div className="tcard-photo">
                    {s.image ? (
                      <>
                        <img src={s.image} alt="" />
                        <label className="focus">
                          кадр
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={s.imageFocus ?? 30}
                            onChange={(e) => updateSlide(s.id, { imageFocus: Number(e.target.value) })}
                          />
                        </label>
                        <button className="link" onClick={() => updateSlide(s.id, { image: undefined })}>
                          убрать фото
                        </button>
                      </>
                    ) : (
                      <>
                        <label className="link">
                          + фото
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setImage(s.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button className="link" onClick={() => openChat(imagePromptFor(s), "Фото")}>
                          фото в ChatGPT
                        </button>
                        {hasKey && (
                          <button className="link" disabled={s.imageStatus === "loading"} onClick={() => generatePhoto(s.id)}>
                            {s.imageStatus === "loading" ? "генерирую…" : "сгенерировать (API)"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {s.imageStatus === "error" && <p className="error">{s.imageError}</p>}
                </div>
              ))}
              <button className="btn btn--wide" onClick={addSlide}>
                + Добавить слайд
              </button>
              <details className="help">
                <summary>Как оформлять текст</summary>
                <ul>
                  <li>Первый абзац — крупный заголовок, дальше — обычный текст. Абзацы разделяйте пустой строкой.</li>
                  <li>
                    <b>Акцент</b> (<code>**слова**</code>) — в заголовке цветом, в тексте жирным.
                  </li>
                  <li>
                    <b>Заголовок</b> (<code># строка</code>) — крупная строка в любом месте слайда.
                  </li>
                  <li>
                    <b>Линия</b> (<code>---</code>), <b>Цитата</b> (<code>&gt; строка</code>), <b>Плашка</b> (<code>! строка</code>,
                    крупно — <code>! # строка</code>).
                  </li>
                  <li>Слайд с фото оформляется как обложка: крупный заголовок капсом, подпись справа.</li>
                  <li>Фото можно перетащить прямо на карточку или на превью.</li>
                </ul>
              </details>
            </div>
          ) : (
            <div className="form">
              <textarea
                className="bigtext"
                value={bigText}
                onChange={(e) => onBigText(e.target.value)}
                placeholder={"Вставьте или напишите весь текст.\n\nСлайды разделяйте строкой\n===\n\nили разбейте кнопками ниже."}
              />
              <p className="hint">
                Слайды разделяются строкой <code>===</code>. Текст без разделителей можно разбить автоматически:
              </p>
              <button className="btn btn--wide" onClick={() => applySplit(paragraphsToSlides(bigText, slides))}>
                Каждый абзац — отдельный слайд
              </button>
              <div className="row">
                <button className="btn grow" onClick={() => applySplit(autoSplit(bigText, splitCount, slides))}>
                  Разбить поровну на
                </button>
                <input
                  className="num"
                  type="number"
                  min={2}
                  max={MAX_SLIDES}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Math.min(MAX_SLIDES, Math.max(2, Number(e.target.value) || 2)))}
                />
                <span className="muted">слайдов</span>
              </div>
            </div>
          )}

          <details className="ai">
            <summary>✨ Написать текст с ChatGPT</summary>
            <div className="form">
              <input
                placeholder="Тема: например, почему скроллинг — не отдых"
                value={project.topic}
                onChange={(e) => setProject((p) => ({ ...p, topic: e.target.value }))}
              />
              <div className="row">
                <button
                  className="btn btn--primary grow"
                  onClick={() =>
                    project.topic.trim()
                      ? openChat(textTaskPrompt(project.topic, splitCount), "Текст")
                      : setToast({ kind: "error", text: "Напишите тему" })
                  }
                >
                  Открыть в ChatGPT
                </button>
                <button className="btn grow" onClick={pasteAnswer}>
                  Вставить ответ
                </button>
              </div>
              {hasKey && (
                <button className="btn btn--wide" disabled={busy} onClick={generateWithApi}>
                  {busy ? "Пишу…" : "Сгенерировать сразу (API-ключ)"}
                </button>
              )}
              <p className="hint">
                ChatGPT ответит в нужном формате — скопируйте ответ и нажмите «Вставить ответ». Слайдов: {splitCount}{" "}
                (меняется в «Одним текстом»).
              </p>
            </div>
          </details>
          <details className="ai">
            <summary>Подпись к посту и сброс</summary>
            <div className="form">
              <label>
                Подпись к посту (попадёт в ZIP как caption.txt)
                <textarea rows={4} value={project.caption} onChange={(e) => setProject((p) => ({ ...p, caption: e.target.value }))} />
              </label>
              <div className="row">
                <button className="btn grow" onClick={loadSample}>
                  Текст-пример
                </button>
                <button className="btn grow" onClick={clearAll}>
                  Очистить всё
                </button>
              </div>
            </div>
          </details>
        </aside>

        {/* ================= Превью ================= */}
        <main className="center">
          <div className="stage" ref={stageRef}>
            <button className="nav" disabled={activeIndex === 0} onClick={() => select(slides[activeIndex - 1].id)}>
              ‹
            </button>
            {active && (
              <div className="stage-slide" {...dropImage(active.id)}>
                <ScaledSlide width={stageW}>
                  <SlideView
                    slide={active}
                    index={activeIndex}
                    total={slides.length}
                    tone={toneOf(slides, activeIndex, design)}
                    design={design}
                    hints
                  />
                </ScaledSlide>
              </div>
            )}
            <button className="nav" disabled={activeIndex >= slides.length - 1} onClick={() => select(slides[activeIndex + 1].id)}>
              ›
            </button>
          </div>
          <div className="stage-bar">
            <span className="muted">
              Слайд {activeIndex + 1} из {slides.length} · 1080×1350
            </span>
            <button className="btn btn--ghost" disabled={exporting} onClick={exportOne}>
              Скачать этот слайд
            </button>
          </div>
          <div className="strip">
            {slides.map((s, i) => (
              <div
                key={s.id}
                className={`thumb ${s.id === active?.id ? "thumb--active" : ""}`}
                onClick={() => select(s.id)}
                {...dropImage(s.id)}
              >
                <ScaledSlide width={84}>
                  <SlideView
                    ref={(el) => {
                      if (el) thumbRefs.current.set(s.id, el);
                      else thumbRefs.current.delete(s.id);
                    }}
                    slide={s}
                    index={i}
                    total={slides.length}
                    tone={toneOf(slides, i, design)}
                    design={design}
                  />
                </ScaledSlide>
                <span>{i + 1}</span>
              </div>
            ))}
            {slides.length < MAX_SLIDES && (
              <button className="thumb thumb--add" onClick={addSlide} title="Добавить слайд">
                +
              </button>
            )}
          </div>
        </main>

        {/* ================= Стиль ================= */}
        <aside className="panel panel--right">
          <div className="tabs">
            <button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>
              Стиль
            </button>
            <button className={tab === "colors" ? "active" : ""} onClick={() => setTab("colors")}>
              Цвета и фото
            </button>
          </div>

          {tab === "style" ? (
            <div className="form">
              <div className="field-title">Тема</div>
              <div className="themes">
                {THEMES.map((t) => {
                  const d = { ...design, ...t.design } as Design;
                  return (
                    <button
                      key={t.id}
                      className={`theme ${design.themeId === t.id ? "active" : ""}`}
                      onClick={() => setDesign({ ...t.design, themeId: t.id })}
                    >
                      <span className="theme-sws">
                        <span className="theme-sw" style={{ background: `linear-gradient(160deg, ${d.light.bg1}, ${d.light.bg2})`, color: d.light.accent }}>
                          <span style={{ fontFamily: `var(--f-${d.headingFont})` }}>Аа</span>
                        </span>
                        <span className="theme-sw" style={{ background: `linear-gradient(160deg, ${d.dark.bg1}, ${d.dark.bg2})`, color: d.dark.accent }}>
                          <span style={{ fontFamily: `var(--f-${d.headingFont})` }}>Аа</span>
                        </span>
                      </span>
                      <span className="theme-name">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <label>
                Шрифт заголовков
                <select value={design.headingFont} onChange={(e) => setDesign({ headingFont: e.target.value })}>
                  {fontOptions}
                </select>
              </label>
              <label>
                Шрифт текста
                <select value={design.bodyFont} onChange={(e) => setDesign({ bodyFont: e.target.value })}>
                  {fontOptions}
                </select>
              </label>
              <label>
                Шрифт на фото
                <select value={design.coverFont} onChange={(e) => setDesign({ coverFont: e.target.value })}>
                  {fontOptions}
                </select>
              </label>
              <label>
                Размер заголовков: {Math.round(design.titleScale * 100)}%
                <input type="range" min={0.6} max={1.5} step={0.05} value={design.titleScale} onChange={(e) => setDesign({ titleScale: Number(e.target.value) })} />
              </label>
              <label>
                Размер текста: {Math.round(design.bodyScale * 100)}%
                <input type="range" min={0.7} max={1.4} step={0.05} value={design.bodyScale} onChange={(e) => setDesign({ bodyScale: Number(e.target.value) })} />
              </label>
              <div className="seg2">
                <button className={design.align === "left" ? "active" : ""} onClick={() => setDesign({ align: "left" })}>
                  Слева
                </button>
                <button className={design.align === "center" ? "active" : ""} onClick={() => setDesign({ align: "center" })}>
                  По центру
                </button>
              </div>

              <div className="field-title">Элементы</div>
              <label>
                Ник
                <input value={design.handle} onChange={(e) => setDesign({ handle: e.target.value })} />
              </label>
              <label className="check">
                <input type="checkbox" checked={design.showCounter} onChange={(e) => setDesign({ showCounter: e.target.checked })} />
                Номер «02 / 11»
              </label>
              <label className="check">
                <input type="checkbox" checked={design.showArrow} onChange={(e) => setDesign({ showArrow: e.target.checked })} />
                Стрелка «листай»
              </label>
              <label className="check">
                <input type="checkbox" checked={design.alternate} onChange={(e) => setDesign({ alternate: e.target.checked })} />
                Чередовать светлый и тёмный фон
              </label>
              <div className="seg2">
                <button className={design.startTone === "light" ? "active" : ""} onClick={() => setDesign({ startTone: "light" })}>
                  Начать со светлого
                </button>
                <button className={design.startTone === "dark" ? "active" : ""} onClick={() => setDesign({ startTone: "dark" })}>
                  С тёмного
                </button>
              </div>
            </div>
          ) : (
            <div className="form">
              {(["light", "dark"] as const).map((tone) => (
                <div key={tone}>
                  <div className="field-title">{tone === "light" ? "Светлые слайды" : "Тёмные слайды"}</div>
                  <div className="colors">
                    {(
                      [
                        ["bg1", "Фон"],
                        ["bg2", "Фон 2"],
                        ["text", "Текст"],
                        ["muted", "Мягкий"],
                        ["accent", "Акцент"],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="color">
                        <input type="color" value={design[tone][k]} onChange={(e) => setPalette(tone, { [k]: e.target.value })} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="field-title">Слайды с фото</div>
              <label className="check">
                <input type="checkbox" checked={design.coverUppercase} onChange={(e) => setDesign({ coverUppercase: e.target.checked })} />
                Заголовок капсом
              </label>
              <label className="check">
                <input type="checkbox" checked={design.haze} onChange={(e) => setDesign({ haze: e.target.checked })} />
                Светлая дымка
              </label>
              <label>
                Затемнение под текстом: {Math.round(design.overlay * 100)}%
                <input type="range" min={0} max={1} step={0.05} value={design.overlay} onChange={(e) => setDesign({ overlay: Number(e.target.value) })} />
              </label>
              <label>
                Стиль фото для ChatGPT
                <select value={design.imageStyleId} onChange={(e) => setDesign({ imageStyleId: e.target.value })}>
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              {design.imageStyleId === "custom" && (
                <textarea
                  rows={2}
                  placeholder="Например: soft beige portrait photo, natural window light"
                  value={design.customImageStyle}
                  onChange={(e) => setDesign({ customImageStyle: e.target.value })}
                />
              )}
              <label className="btn">
                Загрузить несколько фото по порядку
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    const files = sortImageFiles(Array.from(e.target.files ?? []));
                    const targets = slides.filter((s) => !s.image);
                    files.slice(0, targets.length).forEach((f, i) => setImage(targets[i].id, f));
                    setToast({ kind: "info", text: `Фото добавлено на слайды без фото: ${Math.min(files.length, targets.length)}.` });
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="btn"
                onClick={() => openChat(imagesTaskPrompt(slides.filter((s) => !s.image).slice(0, 10).map(imagePromptFor)), "Серия фото")}
              >
                Серия фото в ChatGPT (для слайдов без фото)
              </button>
            </div>
          )}
        </aside>
      </div>

      {showSettings && (
        <div className="modal-bg" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Автоматическая генерация (необязательно)</h3>
            <div className="form">
              <p className="hint">
                Без ключа всё работает вручную и через обычный ChatGPT. С API-ключом OpenAI текст и фото генерируются прямо
                здесь (API оплачивается отдельно от подписки). Ключ хранится только в этом браузере.{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  Получить ключ
                </a>
              </p>
              <label>
                API-ключ
                <input type="password" placeholder="sk-…" value={settings.apiKey} onChange={(e) => updateSettings({ apiKey: e.target.value })} />
              </label>
              <label>
                Модель текста
                <input value={settings.textModel} onChange={(e) => updateSettings({ textModel: e.target.value })} />
              </label>
              <label>
                Модель изображений
                <input value={settings.imageModel} onChange={(e) => updateSettings({ imageModel: e.target.value })} />
              </label>
              <label>
                Качество изображений
                <select value={settings.imageQuality} onChange={(e) => updateSettings({ imageQuality: e.target.value as Settings["imageQuality"] })}>
                  <option value="low">Низкое — быстро</option>
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

      {showPreview && <InstagramPreview project={project} onClose={() => setShowPreview(false)} />}

      {toast && (
        <div className={`toast toast--${toast.kind}`} onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
