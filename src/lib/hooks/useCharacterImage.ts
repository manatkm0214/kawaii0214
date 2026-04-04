"use client";
import { useState, useEffect, useCallback } from "react";

export const CHARACTER_URL_KEY = "kakeibo-character-url";
export const CHARACTER_NAME_KEY = "kakeibo-character-name";

function readFromStorage(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

export function useCharacterImage() {
  const [characterUrl, setCharacterUrlState] = useState<string>("");
  const [characterName, setCharacterNameState] = useState<string>("");

  useEffect(() => {
    setCharacterUrlState(readFromStorage(CHARACTER_URL_KEY));
    setCharacterNameState(readFromStorage(CHARACTER_NAME_KEY));

    function handleUpdate() {
      setCharacterUrlState(readFromStorage(CHARACTER_URL_KEY));
      setCharacterNameState(readFromStorage(CHARACTER_NAME_KEY));
    }
    window.addEventListener("kakeibo-character-updated", handleUpdate);
    return () => window.removeEventListener("kakeibo-character-updated", handleUpdate);
  }, []);

  const setCharacterUrl = useCallback((url: string) => {
    localStorage.setItem(CHARACTER_URL_KEY, url);
    setCharacterUrlState(url);
    window.dispatchEvent(new Event("kakeibo-character-updated"));
  }, []);

  const setCharacterName = useCallback((name: string) => {
    localStorage.setItem(CHARACTER_NAME_KEY, name);
    setCharacterNameState(name);
  }, []);

  const clearCharacter = useCallback(() => {
    localStorage.removeItem(CHARACTER_URL_KEY);
    localStorage.removeItem(CHARACTER_NAME_KEY);
    setCharacterUrlState("");
    setCharacterNameState("");
    window.dispatchEvent(new Event("kakeibo-character-updated"));
  }, []);

  return { characterUrl, characterName, setCharacterUrl, setCharacterName, clearCharacter };
}
