import { create } from "zustand";

interface UiState {
  presentationMode: boolean;
  togglePresentationMode: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const PRESENTATION_KEY = "lodestar:presentation-mode";

export const useUiStore = create<UiState>((set, get) => ({
  presentationMode: false,
  togglePresentationMode: () => {
    const next = !get().presentationMode;
    set({ presentationMode: next });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRESENTATION_KEY, next ? "1" : "0");
      document.documentElement.classList.toggle("presentation", next);
    }
  },
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));

export function initPresentationModeFromStorage() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(PRESENTATION_KEY) === "1";
  if (stored) {
    document.documentElement.classList.add("presentation");
    useUiStore.setState({ presentationMode: true });
  }
}
