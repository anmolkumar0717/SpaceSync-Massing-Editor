# SpaceSync — Massing Editor

Browser-based 3D building massing editor. Built with React Three Fiber + Three.js + Zustand.

---

## How to Run

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

---

## Tech Stack

**Three.js via @react-three/fiber** — chosen over Babylon.js for tighter React integration, better ecosystem support (Drei helpers), and familiarity with the Zustand state model. The trade-off is slightly more manual shadow setup, which is straightforward.

---

## Pivot-Correct Height Resize

When the user changes a mass's height, instead of using `mesh.scaling` (which scales from the center), we offset `position.y` by half the height delta:

```
newY = currentY + (newH - oldH) / 2
```

This keeps the bottom face anchored at its exact Y position — whether the mass sits on the ground or stacked on another mass. The `updateMassCmd` command stores both the old and new `{height, position}` so undo fully reverts both values.

---

## Controls

| Action | How |
|---|---|
| Place mass | Click on ground |
| Stack mass | Click on top face of existing mass |
| Select | Click a mass |
| Multi-select | Shift + click |
| Deselect | Click empty ground |
| Move mass | Select one, press **G**, move mouse, click to confirm |
| Delete | **Delete** key or panel button |
| Undo | **Ctrl+Z** |
| Redo | **Ctrl+Y** |
| Plan view | Toggle in status bar |
| Sun angle | Drag slider in status bar (6am–6pm) |
| Export JSON | ↓ JSON button in toolbar |

---

## Requirements Met (100 pts)

- ✅ **01** — 3D scene, ground, directional light, orbit camera, 1m grid, axis helper
- ✅ **02** — Click-to-place 10×10×3m masses, grid snap, top-face stacking (no clipping)
- ✅ **03** — Single/multi-select, Shift+click, drag vs click (5px threshold), bounding box
- ✅ **04** — Properties panel, live W/D/H sync, pivot-correct height, min 1m, panel clears
- ✅ **05** — castShadow / receiveShadow on all masses, shadow map updates live
- ✅ **06** — Delete key + panel button, Ctrl+Z/Ctrl+Y, command pattern, 20-step history
- ✅ **07** — 50×40m site boundary, FAR = floor area / 2000, red when >2.5, 0.00 on empty

## Bonus Implemented

- ✅ **+10** — Drag to move with G key, grid snap, no orbit conflict
- ✅ **+10** — Overlap warning (3D AABB), both masses turn red, clears on separation
- ✅ **+10** — Sun shadow simulation (6am–6pm slider)
- ✅ **+5**  — IFC-style JSON export
- ✅ **+5**  — Mass rename (inline in panel, billboard label in 3D, auto Block A/B/C...)

## One Thing I'd Improve

The plan view currently just sets the camera to orthographic top-down. Given more time, I'd render a proper 2D canvas overlay using the masses' XZ positions to draw filled, labeled rectangles — with dimension annotations — independently of the 3D renderer, so it reads cleanly as an architectural plan.

---

*Built with AI assistance (Claude). All architecture, logic, and edge-case handling authored and reviewed manually.*
