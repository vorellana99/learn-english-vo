import { useSyncExternalStore } from "react";

// "Always show translations" preference, remembered in the browser.
const KEY = "translations";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

let always = read();
const listeners = new Set<() => void>();

export const translationPref = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => always,
  set(on: boolean) {
    always = on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  },
};

export const useAlwaysTranslate = () => useSyncExternalStore(translationPref.subscribe, translationPref.get);
