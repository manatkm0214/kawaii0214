import React, { useState } from "react";
import { FaLine, FaEnvelope, FaLock } from "react-icons/fa";
import { useCharacterImage } from "../hooks/useCharacterImage";

interface AuthViewProps {
  onAuth: (mode?: 'login' | 'register') => void;
  onBack: () => void;
  initialMessage?: { type: "success" | "error"; text: string } | null;
  initialEmail?: string;
  onGuestLogin?: () => void;
  idolImageUrl?: string;
}

const AuthView: React.FC<AuthViewProps> = ({ onAuth, onBack, initialMessage, initialEmail, onGuestLogin, idolImageUrl }) => {
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [showLineQR, setShowLineQR] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>("login");
  const { characterUrl, characterName } = useCharacterImage();

  // propsで明示的に渡された場合はそれを優先、なければlocalStorageから
  const displayUrl = idolImageUrl || characterUrl;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-linear-to-br from-pink-100 via-purple-100 to-yellow-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">

      {/* 浮遊キャラクター（背景） */}
      {displayUrl && (
        <div className="fixed bottom-6 left-6 z-10 flex flex-col items-center gap-1 pointer-events-none select-none">
          <div className="animate-float">
            <img
              src={displayUrl}
              alt={characterName || "キャラクター"}
              className="w-20 h-20 rounded-full object-cover border-4 border-pink-200 dark:border-violet-400 shadow-xl opacity-90"
            />
          </div>
          {characterName && (
            <span className="text-xs font-bold text-pink-500 dark:text-violet-300 bg-white/60 dark:bg-slate-900/60 rounded-full px-2 py-0.5">
              {characterName}
            </span>
          )}
        </div>
      )}

      <div className="w-full max-w-xs bg-white/80 dark:bg-slate-900/90 rounded-3xl shadow-2xl p-8 flex flex-col items-center border border-pink-200 dark:border-slate-700 relative z-20">
        <div className="flex flex-col items-center mb-4 w-full">
          {/* ログインフォーム上部のキャラクター */}
          {displayUrl && (
            <img
              src={displayUrl}
              alt={characterName || "画像"}
              className="w-16 h-16 rounded-full object-cover border-4 border-pink-200 shadow-lg mb-2"
            />
          )}
          <div className="flex w-full mb-2">
            <button
              type="button"
              className={`flex-1 py-2 rounded-l-2xl font-bold text-sm ${mode === "login" ? "bg-pink-200 text-pink-700 shadow" : "bg-white dark:bg-slate-800 text-pink-400 border-r border-pink-100"}`}
              onClick={() => setMode("login")}
            >ログイン</button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-r-2xl font-bold text-sm ${mode === "register" ? "bg-violet-200 text-violet-700 shadow" : "bg-white dark:bg-slate-800 text-violet-400 border-l border-violet-100"}`}
              onClick={() => setMode("register")}
            >新規登録</button>
          </div>
          <h2 className="text-xl font-extrabold text-pink-500 drop-shadow mb-1 flex items-center gap-2">
            <FaEnvelope className="text-pink-400" /> {mode === "login" ? "ログイン" : "新規登録"}
          </h2>
        </div>
        {initialMessage && (
          <div className={`mb-4 px-4 py-2 rounded-xl font-bold text-center ${initialMessage.type === "success" ? "bg-green-100 text-green-700 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"}`}>
            {initialMessage.text}
          </div>
        )}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="mb-2 px-4 py-2 border-2 border-pink-200 rounded-xl w-64 focus:outline-none focus:border-pink-400 bg-white dark:bg-slate-800 dark:text-slate-100 shadow"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="パスワード"
          className="mb-4 px-4 py-2 border-2 border-pink-200 rounded-xl w-64 focus:outline-none focus:border-pink-400 bg-white dark:bg-slate-800 dark:text-slate-100 shadow"
        />
        <div className="flex flex-col gap-2 w-full mb-4">
          <button
            type="button"
            onClick={() => onAuth(mode)}
            className="w-full px-4 py-2 bg-linear-to-r from-pink-400 to-violet-400 text-white font-bold rounded-xl shadow hover:from-pink-500 hover:to-violet-500 transition"
          >
            <FaEnvelope className="inline mr-2" />メールで{mode === "login" ? "ログイン" : "新規登録"}
          </button>
          <button
            type="button"
            onClick={() => window.location.href = "/api/auth/line/start"}
            className="w-full px-4 py-2 bg-green-400 text-white font-bold rounded-xl shadow flex items-center justify-center gap-2 hover:bg-green-500 transition"
          >
            <FaLine className="text-2xl" /> LINEでログイン
          </button>
          <button
            type="button"
            onClick={() => setShowLineQR(v => !v)}
            className="w-full px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl shadow flex items-center justify-center gap-2 hover:bg-green-100 border border-green-200 transition text-xs"
          >
            QRでLINEログイン
          </button>
          {showLineQR && (
            <div className="flex flex-col items-center mt-2 mb-2 p-2 bg-green-50 rounded-xl border border-green-200 shadow-inner">
              <span className="text-xs text-green-700 mb-1">LINEアプリでQRをスキャン</span>
              <img src="/api/auth/line/start" alt="LINE QR" className="w-36 h-36 rounded-lg border-2 border-green-300" />
              <a href="/api/auth/line/start" target="_blank" rel="noopener noreferrer" className="mt-2 text-green-600 underline text-xs">LINE認証ページを開く</a>
            </div>
          )}
          {onGuestLogin && (
            <button
              type="button"
              onClick={onGuestLogin}
              className="w-full px-4 py-2 bg-slate-700 text-white font-bold rounded-xl shadow hover:bg-slate-800 transition"
            >ゲストとして試す</button>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full mb-2">
          <a
            href="/auth/reset-password"
            className="w-full px-4 py-2 bg-yellow-100 text-yellow-700 font-bold rounded-xl shadow flex items-center justify-center gap-2 hover:bg-yellow-200 transition text-sm"
          >
            <FaLock className="text-base" /> パスワード再設定はこちら
          </a>
        </div>
        <div className="flex flex-col gap-2 w-full mb-2">
          <a
            href="/settings"
            className="w-full px-4 py-2 bg-pink-50 dark:bg-slate-800 text-pink-500 dark:text-violet-300 font-bold rounded-xl shadow flex items-center justify-center gap-2 hover:bg-pink-100 dark:hover:bg-slate-700 transition text-xs border border-pink-200 dark:border-slate-700"
          >
            🎨 キャラクター設定
          </a>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl w-full font-bold shadow hover:bg-gray-300 dark:hover:bg-slate-600 transition"
        >戻る</button>
      </div>
    </div>
  );
};

export default AuthView;
