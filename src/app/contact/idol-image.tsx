"use client";
import { useState } from "react";
import Image from "next/image";
import { CHARACTER_URL_KEY, CHARACTER_NAME_KEY } from "../../lib/hooks/useCharacterImage";

export default function CustomImage() {
  const [url, setUrl] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(CHARACTER_URL_KEY) || "";
    }
    return "";
  });
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(CHARACTER_NAME_KEY) || "";
    }
    return "";
  });

  const handleSave = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHARACTER_URL_KEY, url);
      window.localStorage.setItem(CHARACTER_NAME_KEY, name);
      window.dispatchEvent(new Event("kakeibo-character-updated"));
      alert("画像と名前を保存しました！");
    }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <h1 className="text-xl font-bold mb-4">キャラクター設定</h1>
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-4"
        placeholder="画像URLを入力"
      />
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-4"
        placeholder="キャラクター名（任意）"
      />
      {url && (
        <Image
          src={url}
          alt={name || "画像プレビュー"}
          width={128}
          height={128}
          className="w-32 h-32 object-cover rounded-full border-4 border-violet-400 mx-auto mb-4"
          unoptimized
        />
      )}
      {name && (
        <div className="text-center text-lg font-semibold mb-4">{name}</div>
      )}
      <button
        type="button"
        className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-2 px-4 rounded"
        onClick={handleSave}
      >保存</button>
    </div>
  );
}
