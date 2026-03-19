import { useStore } from "./store";

const st = () => useStore.getState();

/** Add one mass. Undo removes it. */
export const addMassCmd = (mass) => ({
    execute: () => st()._addMass(mass),
    undo: () => st()._removeMass(mass.id),
});

/**
 * Delete one or more masses.
 * Undo restores them in original order with original positions (incl. stacked Y).
 */
export const deleteMassesCmd = (masses) => ({
    execute: () => masses.forEach((m) => st()._removeMass(m.id)),
    undo: () => {
        masses.forEach((m) => st()._addMass(m));
        st().setSelection(masses.map((m) => m.id));
    },
});

/**
 * Update arbitrary props on a mass.
 * oldProps / newProps contain ONLY the changed keys.
 * For height resize, include position in both so undo fully reverts Y.
 */
export const updateMassCmd = (id, oldProps, newProps) => ({
    execute: () => st()._updateMass(id, newProps),
    undo: () => st()._updateMass(id, oldProps),
});

/** Move a mass to a new position (grab tool). */
export const moveMassCmd = (id, oldPos, newPos) => ({
    execute: () => st()._updateMass(id, { position: newPos }),
    undo: () => st()._updateMass(id, { position: oldPos }),
});