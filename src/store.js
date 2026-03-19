import { create } from "zustand";
import { nanoid } from "nanoid";

// ─── Constants ────────────────────────────────────────────────────────────────
export const SITE = { w: 50, d: 40, area: 2000 };
export const DEFAULTS = { width: 10, depth: 10, height: 3 };
export const FLOOR_H = 3;
export const FAR_LIMIT = 2.5;

const COLORS = [
    "#7eb5c4", "#8fab8c", "#c4a882", "#9b8db4", "#b4887e",
    "#7a9db4", "#a8b47e", "#b4a07a", "#8db4a8", "#c4907a",
];
let _ci = 0;
let _bi = 0;

export const nextColor = () => COLORS[_ci++ % COLORS.length];
export const nextName = () => `Block ${String.fromCharCode(65 + (_bi++ % 26))}`;

/** Create a full mass data object (does NOT add to store). */
export function createMassData({ position, width, depth, height } = {}) {
    const w = width ?? DEFAULTS.width;
    const d = depth ?? DEFAULTS.depth;
    const h = height ?? DEFAULTS.height;
    return {
        id: nanoid(),
        name: nextName(),
        color: nextColor(),
        width: w, depth: d, height: h,
        position: position ?? [0, h / 2, 0],
    };
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useStore = create((set) => ({
    masses: [],
    selectedIds: [],
    sunTime: 10,   // hour 6–18
    isPlanView: false,

    // ── low-level (only commands may call these) ──────────────────────────────
    _addMass: (m) => set((s) => ({ masses: [...s.masses, m] })),
    _removeMass: (id) => set((s) => ({
        masses: s.masses.filter((m) => m.id !== id),
        selectedIds: s.selectedIds.filter((x) => x !== id),
    })),
    _updateMass: (id, diff) => set((s) => ({
        masses: s.masses.map((m) => (m.id === id ? { ...m, ...diff } : m)),
    })),

    // ── selection ──────────────────────────────────────────────────────────────
    selectSingle: (id) => set({ selectedIds: [id] }),
    toggleSelect: (id) => set((s) => {
        const ids = new Set(s.selectedIds);
        ids.has(id) ? ids.delete(id) : ids.add(id);
        return { selectedIds: [...ids] };
    }),
    clearSelection: () => set({ selectedIds: [] }),
    setSelection: (ids) => set({ selectedIds: ids }),

    // ── ui ─────────────────────────────────────────────────────────────────────
    setSunTime: (t) => set({ sunTime: t }),
    setPlanView: (v) => set({ isPlanView: v }),
}));