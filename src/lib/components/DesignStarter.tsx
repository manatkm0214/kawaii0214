"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { BG_KEY, BG_PRESETS } from "@/lib/hooks/useBgTheme";
import { CHARACTER_BG_KEY, useCharacterImage } from "@/lib/hooks/useCharacterImage";
import { STYLE_OVERLAYS, STYLE_PALETTES, makeGeneratedBackground } from "@/lib/designOptions";
import { useLang } from "@/lib/hooks/useLang";

export const DESIGN_STARTER_DONE_KEY = "kakeibo-design-starter-done";
const DESIGN_PRESETS_KEY = "kakeibo-design-presets";

type StarterStep = 1 | 2 | 3;

type SavedDesign = {
  id: string;
  name: string;
  background: string;
  theme: "dark" | "light";
  characterUrl: string;
  characterName: string;
  characterBackground: boolean;
  createdAt: number;
};

function readSavedDesigns(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DESIGN_PRESETS_KEY);
    return raw ? (JSON.parse(raw) as SavedDesign[]) : [];
  } catch {
    return [];
  }
}

function writeSavedDesigns(next: SavedDesign[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DESIGN_PRESETS_KEY, JSON.stringify(next));
}

function applyTheme(theme: "dark" | "light") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("kakeibo-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function applyBackground(id: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BG_KEY, value);
  window.localStorage.setItem(`${BG_KEY}-id`, id);
  document.documentElement.style.setProperty("--background", value);
  window.dispatchEvent(new Event("kakeibo-bg-updated"));
}

function makeDesignId(name: string) {
  return `${name.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
}

function getImageExtension(url: string) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);/);
    const subtype = match?.[1]?.split("/")[1] || "png";
    if (subtype === "jpeg") return "jpg";
    if (subtype.includes("+")) return subtype.split("+")[0];
    return subtype;
  }

  const directMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return directMatch?.[1]?.toLowerCase() || "png";
}

async function downloadImageFile(url: string, filename: string) {
  let objectUrl: string | undefined;
  let href = url;

  if (!url.startsWith("data:")) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Could not fetch the image for download.");
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    href = objectUrl;
  }

  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
}

type DesignStarterProps = {
  onContinue: () => void;
  onBack: () => void;
  backLabel?: { ja: string; en: string };
  continueLabel?: { ja: string; en: string };
};

export default function DesignStarter({ onContinue, onBack, backLabel, continueLabel }: DesignStarterProps) {
  const lang = useLang();
  const t = (ja: string, en: string) => (lang === "en" ? en : ja);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    characterUrl,
    characterName,
    backgroundEnabled,
    setCharacterUrl,
    setCharacterName,
    setBackgroundEnabled,
  } = useCharacterImage();

  const [step, setStep] = useState<StarterStep>(1);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("kakeibo-theme") === "dark" ? "dark" : "light";
  });
  const [bgId, setBgId] = useState(() => {
    if (typeof window === "undefined") return BG_PRESETS[0].id;
    return window.localStorage.getItem(`${BG_KEY}-id`) || BG_PRESETS[0].id;
  });
  const [customBackground, setCustomBackground] = useState(() => {
    if (typeof window === "undefined") return BG_PRESETS[0].value;
    return window.localStorage.getItem(BG_KEY) || BG_PRESETS[0].value;
  });
  const [nameInput, setNameInput] = useState(characterName || "");
  const [urlInput, setUrlInput] = useState(characterUrl || "");
  const [designName, setDesignName] = useState("");
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(() => readSavedDesigns());
  const [status, setStatus] = useState("");

  const previewUrl = urlInput || characterUrl;
  const previewName = nameInput || characterName;
  const progress = `${Math.round((step / 3) * 100)}%`;
  
  function makeDownloadFilename() {
    const rawBaseName = (previewName || t("かわいい家計簿", "cute-kakeibo"))
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const baseName = rawBaseName || "cute-kakeibo";
    const extension = getImageExtension(previewUrl || "");
    return `${baseName}.${extension}`;
  }

  async function handleSaveImage(url: string) {
    try {
      await downloadImageFile(url, makeDownloadFilename());
      setStatus(t("画像を保存しました。", "Saved the image."));
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : t("画像の保存に失敗しました。", "Could not save the image."),
      );
    }
  }
  const secondaryLabel = backLabel ?? { ja: "タイトルにいく", en: "Go to title" };
  const primaryLabel = continueLabel ?? { ja: "次へ進む", en: "Next" };

  const generatedVariants = useMemo(
    () =>
      STYLE_PALETTES.flatMap((palette) =>
        STYLE_OVERLAYS.map((overlay) => ({
          id: `${palette.id}-${overlay.id}`,
          label: `${lang === "en" ? palette.labelEn : palette.labelJa} ${lang === "en" ? overlay.labelEn : overlay.labelJa}`,
          background: makeGeneratedBackground(palette, overlay),
        })),
      ),
    [lang],
  );

  const stepCards = [
    { id: 1, label: t("雰囲気", "Mood") },
    { id: 2, label: t("背景", "Background") },
    { id: 3, label: t("画像と保存", "Image and save") },
  ] as const;

  function goNext() {
    setStep((prev) => (prev < 3 ? ((prev + 1) as StarterStep) : prev));
  }

  function goPrev() {
    setStep((prev) => (prev > 1 ? ((prev - 1) as StarterStep) : prev));
  }

  function handleTheme(nextTheme: "dark" | "light") {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setStatus(t("テーマを更新しました。", "Theme updated."));
  }

  function handlePresetBackground(id: string, value: string) {
    setBgId(id);
    setCustomBackground(value);
    applyBackground(id, value);
    setStatus(t("背景を更新しました。", "Background updated."));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const nextUrl = String(readerEvent.target?.result || "");
      setUrlInput(nextUrl);
      setCharacterUrl(nextUrl);
      setStatus(t("画像を読み込みました。", "Loaded the image."));
    };
    reader.readAsDataURL(file);
  }

  function saveCurrentDesign() {
    const fallbackName = previewName || t("かわいい家計簿デザイン", "Cute Kakeibo design");
    const useName = (designName || fallbackName).trim();
    const next: SavedDesign = {
      id: makeDesignId(useName),
      name: useName,
      background: customBackground || BG_PRESETS[0].value,
      theme,
      characterUrl: urlInput || characterUrl,
      characterName: nameInput || characterName,
      characterBackground: backgroundEnabled,
      createdAt: Date.now(),
    };
    const updated = [next, ...savedDesigns];
    setSavedDesigns(updated);
    writeSavedDesigns(updated);
    setDesignName("");
    setStatus(t("このデザインを保存しました。", "Saved this design."));
  }

  function applySavedDesign(design: SavedDesign) {
    setTheme(design.theme);
    applyTheme(design.theme);
    setBgId(design.id);
    setCustomBackground(design.background);
    applyBackground(design.id, design.background);
    setUrlInput(design.characterUrl || "");
    setNameInput(design.characterName || "");
    setCharacterUrl(design.characterUrl || "");
    setCharacterName(design.characterName || "");
    setBackgroundEnabled(design.characterBackground);
    setStatus(t("保存済みデザインを反映しました。", "Applied the saved design."));
  }

  function handleContinue() {
    setCharacterName(nameInput.trim());
    setCharacterUrl(urlInput.trim());
    window.localStorage.setItem(CHARACTER_BG_KEY, backgroundEnabled ? "1" : "0");
    window.dispatchEvent(new Event("kakeibo-character-updated"));
    window.localStorage.setItem(DESIGN_STARTER_DONE_KEY, "1");
    onContinue();
  }

  return (
    <div className="design-light-shell relative min-h-[78vh] overflow-hidden rounded-[36px] border border-slate-200 bg-white px-5 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.12)] md:px-8 md:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_30%)]" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.42em] text-cyan-200">{t("デザイン設定", "Design setup")}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              {t("最初に、好きな見た目を選びます。", "Choose the look you want first.")}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              {t(
                "背景やキャラクター画像を調整して、ログイン前にアプリの雰囲気を決められます。",
                "Adjust the background and character image so the app feels right before login.",
              )}
            </p>
          </div>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200">
            {t("進行", "Progress")}: {step}/3
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-700 bg-slate-900 p-4">
          <div className="h-2 rounded-full bg-slate-950">
            <div className="h-2 rounded-full bg-cyan-400 transition-all" style={{ width: progress }} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {stepCards.map((item) => (
              <div
                key={item.id}
                className={`rounded-[22px] border px-4 py-3 text-sm ${
                  step === item.id
                    ? "border-cyan-700 bg-cyan-950 text-cyan-100"
                    : step > item.id
                      ? "border-emerald-800 bg-emerald-950 text-emerald-100"
                      : "border-slate-700 bg-slate-950 text-slate-300"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.22em] opacity-70">{item.id}</p>
                <p className="mt-1 font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {status && (
          <div className="rounded-[24px] border border-cyan-800 bg-cyan-950 px-5 py-4 text-sm text-cyan-100">
            {status}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <div className="space-y-5">
            {step === 1 && (
              <div className="rounded-[28px] border border-slate-700 bg-slate-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t("テーマを選ぶ", "Pick a theme")}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {t("明るい印象と落ち着いた印象から選べます。", "Pick between a bright and a calm look.")}
                    </p>
                  </div>
                  <button type="button" onClick={goNext} className="app-chip">
                    {t("次へ進む", "Next")}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {([
                    { key: "light", title: t("やわらかいライト", "Soft light"), note: t("明るく軽やかな印象で始めたい時に向いています。", "Great for a bright and airy start.") },
                    { key: "dark", title: t("落ち着いたダーク", "Calm dark"), note: t("読みやすさを重視したい時や夜の利用に向いています。", "Great for readability and evening use.") },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleTheme(option.key)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        theme === option.key
                          ? option.key === "light"
                            ? "border-cyan-300 bg-white text-slate-900 shadow-[0_18px_40px_-24px_rgba(56,189,248,0.38)]"
                            : "border-fuchsia-500 bg-slate-950 text-white shadow-[0_18px_40px_-24px_rgba(244,114,182,0.34)]"
                          : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                      }`}
                    >
                      <p className="text-sm font-semibold">{option.title}</p>
                      <p className={`mt-2 text-xs leading-6 ${theme === option.key ? (option.key === "light" ? "text-slate-600" : "text-slate-300") : "text-slate-400"}`}>{option.note}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-[28px] border border-slate-700 bg-slate-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t("背景を選ぶ", "Choose a background")}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {t("プリセットと生成スタイルから選べます。", "Choose from presets and generated styles.")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={goPrev} className="app-chip">
                      {t("戻る", "Back")}
                    </button>
                    <button type="button" onClick={goNext} className="app-chip">
                      {t("次へ進む", "Next")}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BG_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      style={{ background: preset.value }}
                      onClick={() => handlePresetBackground(preset.id, preset.value)}
                      className={`relative h-24 rounded-[24px] border transition hover:scale-[1.02] ${
                        bgId === preset.id ? "border-cyan-300" : "border-slate-700"
                      }`}
                    >
                      <span className="absolute inset-x-3 bottom-3 text-xs font-semibold text-white drop-shadow-lg">{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-white">{t("生成スタイル", "Generated styles")}</h4>
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                      {generatedVariants.length} {t("種類", "styles")}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {generatedVariants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => handlePresetBackground(variant.id, variant.background)}
                        style={{ background: variant.background }}
                        className={`relative h-24 rounded-[24px] border transition hover:scale-[1.02] ${
                          bgId === variant.id ? "border-cyan-300" : "border-slate-700"
                        }`}
                      >
                        <span className="absolute inset-x-3 bottom-3 text-[11px] font-semibold text-white drop-shadow-lg">{variant.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mt-5 block text-sm font-medium text-slate-200">
                  {t("背景は上の一覧から選んでください。", "Choose a background from the options above.")}
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="rounded-[28px] border border-slate-700 bg-slate-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t("画像と保存", "Image and save")}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {t("画像や表示名を整えて、デザインとして保存できます。", "Add an image and name, then save it as a design.")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={goPrev} className="app-chip">
                      {t("戻る", "Back")}
                    </button>
                    <button
                      type="button"
                      onClick={handleContinue}
                      className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      {t("次へ進む", "Next")}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    placeholder={t("表示名", "Display name")}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    placeholder={t("画像 URL", "Image URL")}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} className="app-chip">
                      {t("画像を選ぶ", "Choose image")}
                    </button>
                    {previewUrl && (
                      <button type="button" onClick={() => void handleSaveImage(previewUrl)} className="app-chip">
                        {t("現在の画像を保存", "Save current image")}
                      </button>
                    )}
                    {previewUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setUrlInput("");
                          setCharacterUrl("");
                          setStatus(t("画像を消去しました。", "Cleared the image."));
                        }}
                        className="rounded-full border border-rose-800 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900"
                      >
                        {t("画像を消去", "Clear image")}
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                    <input
                      type="text"
                      value={designName}
                      onChange={(event) => setDesignName(event.target.value)}
                      placeholder={t("保存するデザイン名", "Design name to save")}
                      className="min-w-[220px] flex-1 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    />
                    <button type="button" onClick={saveCurrentDesign} className="app-chip">
                      {t("保存", "Save")}
                    </button>
                  </div>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={backgroundEnabled}
                      onChange={(event) => setBackgroundEnabled(event.target.checked)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    {t("画像を背景演出にも使う", "Use the image in the background too")}
                  </label>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-white">{t("保存済みデザイン", "Saved designs")}</h4>
                    <span className="text-xs text-slate-400">{savedDesigns.length} / 8</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {savedDesigns.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950 px-4 py-5 text-sm text-slate-400">
                        {t("まだ保存されたデザインはありません。", "No saved designs yet.")}
                      </div>
                    ) : (
                      savedDesigns.slice(0, 8).map((design) => (
                        <div key={design.id} className="rounded-[24px] border border-slate-700 bg-slate-950 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">{design.name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {design.theme === "dark" ? t("ダーク", "Dark") : t("ライト", "Light")}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => applySavedDesign(design)} className="app-chip">
                                {t("反映", "Apply")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = savedDesigns.filter((d) => d.id !== design.id);
                                  setSavedDesigns(updated);
                                  writeSavedDesigns(updated);
                                }}
                                className="rounded-full border border-rose-800 bg-rose-950 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900"
                              >
                                {t("削除", "Delete")}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 h-20 rounded-[20px] border border-slate-700" style={{ background: design.background }} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="rounded-[30px] border border-slate-700 bg-slate-950 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{t("かわいい家計簿プレビュー", "Cute Kakeibo Preview")}</p>
              <div className="mt-4 overflow-hidden rounded-[32px] border border-slate-700 p-5" style={{ background: customBackground || BG_PRESETS[0].value }}>
                <div className="rounded-[28px] border border-slate-700 bg-slate-900 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">{t("かわいい家計簿ボード", "Cute Kakeibo Board")}</p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">{previewName || t("かわいい家計簿", "Cute Kakeibo")}</h3>
                      <p className="mt-2 text-sm text-slate-300">{t("あとからいつでも切り替えられるデザインです。", "You can switch this design later any time.")}</p>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200">
                      {theme === "dark" ? t("ダーク", "Dark") : t("ライト", "Light")}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[0.72fr_1.28fr]">
                    <div className="flex min-h-[210px] items-center justify-center rounded-[28px] border border-slate-700 bg-slate-900 p-4">
                      {previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt={previewName || t("キャラクター画像", "Character image")}
                          width={220}
                          height={220}
                          className="h-52 w-full rounded-[24px] object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-52 w-full items-center justify-center rounded-[24px] bg-slate-950 text-center text-sm text-slate-400">
                          {t("ここに画像プレビューが表示されます", "Image preview appears here")}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { label: t("収入", "Income"), value: "¥280,000" },
                          { label: t("支出", "Expense"), value: "¥168,000" },
                          { label: t("生活レベル", "Life level"), value: t("安定", "Balanced") },
                          { label: t("安全度", "Safety"), value: t("良好", "Safe") },
                        ].map((item) => (
                          <div key={item.label} className="rounded-[22px] border border-slate-700 bg-slate-950 p-3">
                            <p className="text-xs text-slate-400">{item.label}</p>
                            <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-[22px] border border-slate-700 bg-slate-950 p-3">
                        <p className="text-xs text-slate-400">{t("メモ", "Note")}</p>
                        <p className="mt-2 text-sm text-slate-200">{t("この見た目をそのまま初期デザインとして使えます。", "You can use this exact look as your starting design.")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={step > 1 ? goPrev : onBack}
                className="rounded-full border border-slate-700 bg-slate-900 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                {step > 1 ? t("戻る", "Back") : t(secondaryLabel.ja, secondaryLabel.en)}
              </button>
              <button
                type="button"
                onClick={step < 3 ? goNext : handleContinue}
                className="flex-1 rounded-full bg-cyan-400 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                {step < 3 ? t("次へ進む", "Next") : t(primaryLabel.ja, primaryLabel.en)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
