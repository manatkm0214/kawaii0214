"use client";
import React, { useState, useRef } from "react";
import { useCharacterImage } from "../../lib/hooks/useCharacterImage";

export default function SettingsPage() {
  const { characterUrl, characterName, setCharacterUrl, setCharacterName, clearCharacter } = useCharacterImage();
  const [inputUrl, setInputUrl] = useState("");
  const [inputName, setInputName] = useState("");
  const [preview, setPreview] = useState("");
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // URLプレビューを更新
  function handleUrlChange(v: string) {
    setInputUrl(v);
    setPreview(v);
    setFileError("");
  }

  // ファイルアップロード → base64変換
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setFileError("ファイルサイズは1.5MB以下にしてください");
      return;
    }
    setFileError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setInputUrl(result);
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    const urlToSave = inputUrl || characterUrl;
    const nameToSave = inputName || characterName;
    if (urlToSave) setCharacterUrl(urlToSave);
    if (nameToSave !== characterName) setCharacterName(nameToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearCharacter();
    setInputUrl("");
    setInputName("");
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const displayUrl = preview || characterUrl;
  const displayName = inputName || characterName;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-8 px-4 bg-linear-to-br from-pink-50 via-violet-50 to-yellow-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* ヘッダー */}
      <div className="w-full max-w-md mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="p-2 rounded-xl bg-white/70 dark:bg-slate-800 border border-pink-200 dark:border-slate-700 text-pink-500 dark:text-slate-300 hover:bg-pink-50 dark:hover:bg-slate-700 transition shadow"
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-extrabold text-pink-500 dark:text-violet-300 drop-shadow">
          キャラクター設定
        </h1>
      </div>

      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 rounded-3xl shadow-2xl border border-pink-200 dark:border-slate-700 p-6 flex flex-col items-center gap-5">

        {/* キャラクタープレビュー */}
        <div className="relative flex flex-col items-center py-6 w-full bg-linear-to-b from-pink-50 to-violet-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-pink-100 dark:border-slate-700 overflow-hidden">
          {/* 背景きらきら */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {["10%,20%", "80%,30%", "50%,70%", "20%,75%", "75%,15%"].map((pos, i) => (
              <span
                key={i}
                className="absolute text-pink-300 dark:text-violet-400 opacity-40 text-lg select-none"
                style={{ left: pos.split(",")[0], top: pos.split(",")[1] }}
              >✦</span>
            ))}
          </div>

          {displayUrl ? (
            <div className="animate-float z-10">
              <img
                src={displayUrl}
                alt={displayName || "キャラクター"}
                className="w-28 h-28 rounded-full object-cover border-4 border-pink-300 dark:border-violet-400 shadow-xl"
              />
            </div>
          ) : (
            <div className="animate-float-slow z-10 w-28 h-28 rounded-full border-4 border-dashed border-pink-300 dark:border-slate-600 flex items-center justify-center bg-white/60 dark:bg-slate-800/60">
              <span className="text-4xl">🌟</span>
            </div>
          )}

          {displayName && (
            <p className="mt-3 text-sm font-bold text-pink-500 dark:text-violet-300 drop-shadow z-10">{displayName}</p>
          )}
          {!displayUrl && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 z-10">画像を設定するとここに表示されます</p>
          )}
        </div>

        {/* 画像URL入力 */}
        <div className="w-full">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">画像URL</label>
          <input
            type="url"
            value={inputUrl}
            onChange={e => handleUrlChange(e.target.value)}
            placeholder="https://... または空欄でファイルを選択"
            className="w-full px-3 py-2 rounded-xl border-2 border-pink-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-pink-400 dark:focus:border-violet-400 transition"
          />
        </div>

        {/* ファイルアップロード */}
        <div className="w-full">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
            画像ファイルをアップロード <span className="font-normal text-slate-400">(1.5MB以下)</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-pink-100 dark:file:bg-slate-700 file:text-pink-600 dark:file:text-violet-300 file:font-bold file:text-xs hover:file:bg-pink-200 dark:hover:file:bg-slate-600 cursor-pointer"
          />
          {fileError && <p className="text-xs text-red-500 mt-1">{fileError}</p>}
        </div>

        {/* キャラクター名 */}
        <div className="w-full">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">キャラクター名（任意）</label>
          <input
            type="text"
            value={inputName}
            onChange={e => setInputName(e.target.value)}
            placeholder={characterName || "名前をつけよう！"}
            className="w-full px-3 py-2 rounded-xl border-2 border-pink-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:border-pink-400 dark:focus:border-violet-400 transition"
          />
        </div>

        {/* ボタン */}
        <div className="w-full flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!inputUrl && !inputName && !characterUrl}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-linear-to-r from-pink-400 to-violet-400 text-white shadow hover:from-pink-500 hover:to-violet-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? "✓ 保存しました！" : "保存する"}
          </button>
          {characterUrl && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 transition border border-slate-200 dark:border-slate-600"
            >
              クリア
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
          設定した画像はこのブラウザのみに保存されます。<br />
          ログイン画面やダッシュボードに表示されます。
        </p>
      </div>
    </div>
  );
}
