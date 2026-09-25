import { create } from 'zustand';

interface ScrollStore {
  scrollProgress: number;
  setScrollProgress: (progress: number) => void;
  /** The main page's scroll only (ScrollWrapper). The work portal reuses
   * scrollProgress for its own timeline, so the intro can't read that. */
  pageProgress: number;
  setPageProgress: (progress: number) => void;
}

export const useScrollStore = create<ScrollStore>((set) => ({
  scrollProgress: 0,
  setScrollProgress: (progress) => set(() => ({ scrollProgress: progress })),
  pageProgress: 0,
  setPageProgress: (progress) => set(() => ({ pageProgress: progress })),
}));
