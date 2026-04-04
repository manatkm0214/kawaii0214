"use client";
import Image from "next/image";
import { useCharacterImage } from "../../lib/hooks/useCharacterImage";

export default function LogoImage() {
  const { characterUrl, characterName } = useCharacterImage();

  if (!characterUrl) return null;

  return (
    <Image
      src={characterUrl}
      alt={characterName || "キャラクター"}
      width={80}
      height={80}
      className="w-20 h-20 rounded-full object-cover border-4 border-violet-400 shadow-idol animate-bounce-slow"
      unoptimized
    />
  );
}
