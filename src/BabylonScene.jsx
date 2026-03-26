/**
 * BabylonScene.jsx
 * Full Babylon.js implementation — replaces Scene / Ground / MassMesh /
 * SelectionBox / SiteBoundary from the old React Three Fiber stack.
 *
 * Architecture: one imperative useEffect creates the engine + scene, then
 * subscribes to the Zustand store. Every store change calls syncState()
 * which diffs the mass map and creates / updates / removes Babylon meshes.
 */

import { useEffect, useRef } from "react";
import {
    Engine, Scene,
    ArcRotateCamera,
    Vector3, Color3, Color4,
    HemisphericLight, DirectionalLight,
    MeshBuilder, StandardMaterial, DynamicTexture,
    ShadowGenerator, HighlightLayer,
    Mesh, PointerEventTypes, Plane,
} from "@babylonjs/core";

import {
    useStore, SITE, DEFAULTS, FLOOR_H, FAR_LIMIT, createMassData,
} from "./store";
import { commandHistory } from "./CommandHistory";
import { addMassCmd, deleteMassesCmd, moveMassCmd } from "./Commands";

const DRAG_THRESHOLD_PX2 = 25; // 5px²

export default function BabylonScene() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // ── Engine & Scene ──────────────────────────────────────────────────────
        const engine = new Engine(canvas, true, { antialias: true, adaptToDeviceRatio: true });
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.10, 0.13, 0.20, 1);

        // ── Camera (ArcRotate = orbit) ──────────────────────────────────────────
        const camera = new ArcRotateCamera(
            "cam",
            -Math.PI / 4,   // alpha
            Math.PI / 3.5,  // beta
            85,             // radius
            Vector3.Zero(),
            scene
        );
        camera.lowerBetaLimit = 0.05;
        camera.upperBetaLimit = Math.PI / 2.05;
        camera.lowerRadiusLimit = 3;
        camera.upperRadiusLimit = 250;
        camera.attachControl(true);

        // ── Lights ──────────────────────────────────────────────────────────────
        const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
        hemi.intensity = 0.40;
        hemi.diffuse = new Color3(0.85, 0.90, 1.00);
        hemi.groundColor = new Color3(0.77, 0.75, 0.69);

        const dirLight = new DirectionalLight("sun", new Vector3(-0.6, -1, -0.4).normalize(), scene);
        dirLight.intensity = 1.50;
        dirLight.position = new Vector3(50, 70, -40);

        // ── Shadow generator ────────────────────────────────────────────────────
        const shadowGen = new ShadowGenerator(2048, dirLight);
        shadowGen.usePoissonSampling = true;

        // ── Highlight layer (selection / overlap glow) ──────────────────────────
        const hl = new HighlightLayer("hl", scene);

        // ── Ground plane ────────────────────────────────────────────────────────
        const ground = MeshBuilder.CreateGround(
            "ground",
            { width: 400, height: 400, subdivisions: 1 },
            scene
        );
        const groundMat = new StandardMaterial("groundMat", scene);
        groundMat.diffuseColor = new Color3(0.86, 0.88, 0.91);
        groundMat.specularColor = new Color3(0, 0, 0);
        ground.material = groundMat;
        ground.receiveShadows = true;

        // ── 1m grid lines (60×60m centred on origin) ────────────────────────────
        const gridLines = [];
        for (let i = -30; i <= 30; i++) {
            gridLines.push([new Vector3(i, 0.005, -30), new Vector3(i, 0.005, 30)]);
            gridLines.push([new Vector3(-30, 0.005, i), new Vector3(30, 0.005, i)]);
        }
        const gridMesh = MeshBuilder.CreateLineSystem("grid", { lines: gridLines }, scene);
        gridMesh.color = new Color3(0.72, 0.76, 0.81);
        gridMesh.isPickable = false;

        // ── Axes helper ─────────────────────────────────────────────────────────
        const AY = 0.008; // lift axes off ground
        const makeAxis = (name, end, col) => {
            const l = MeshBuilder.CreateLines(name, { points: [new Vector3(0, AY, 0), end] }, scene);
            l.color = col; l.isPickable = false;
        };
        makeAxis("ax", new Vector3(8, AY, 0), new Color3(1, 0.2, 0.2));
        makeAxis("ay", new Vector3(0, 8, 0), new Color3(0.2, 1, 0.2));
        makeAxis("az", new Vector3(0, AY, 8), new Color3(0.2, 0.4, 1));

        // ── Site boundary (50×40m) ──────────────────────────────────────────────
        const HW = SITE.w / 2, HD = SITE.d / 2, BY = 0.012;
        const bPts = [
            new Vector3(-HW, BY, -HD), new Vector3(HW, BY, -HD),
            new Vector3(HW, BY, HD), new Vector3(-HW, BY, HD),
            new Vector3(-HW, BY, -HD),
        ];
        const boundary = MeshBuilder.CreateLines("boundary", { points: bPts, updatable: false }, scene);
        boundary.color = new Color3(0.23, 0.51, 1.00);
        boundary.isPickable = false;

        // ── Internal state ──────────────────────────────────────────────────────
        /**
         * meshMap: id → {
         *   box, labelMesh, dt, mat,
         *   prevW, prevH, prevD, prevName, prevColor
         * }
         */
        const meshMap = new Map();
        let selBoxMesh = null; // current multi-select bounding box lines
        const shiftRef = { current: false };
        // grabRef: { id, origPos, axis }
        // axis: null = free XZ plane | 'X' = lock X only | 'Y' = vertical | 'Z' = lock Z only
        const grabRef = { current: null };
        const ptrDownRef = { current: null }; // { x, y, dragged }

        // ── Helper: create one mass mesh + billboard label ──────────────────────
        function createMassMesh(m) {
            const [px, py, pz] = m.position;

            const box = MeshBuilder.CreateBox(`box-${m.id}`, {
                width: m.width, height: m.height, depth: m.depth,
            }, scene);
            box.position.set(px, py, pz);
            box.metadata = { type: "mass", id: m.id };
            box.receiveShadows = true;
            shadowGen.addShadowCaster(box, true);

            const mat = new StandardMaterial(`mat-${m.id}`, scene);
            mat.diffuseColor = Color3.FromHexString(m.color);
            mat.specularColor = new Color3(0.06, 0.06, 0.06);
            box.material = mat;

            // Billboard label (DynamicTexture rendered on a plane parented to the box)
            const labelMesh = MeshBuilder.CreatePlane(`label-${m.id}`, { width: 8, height: 1.8 }, scene);
            labelMesh.position.y = m.height / 2 + 1.4;
            labelMesh.parent = box;
            labelMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
            labelMesh.isPickable = false;

            const dt = new DynamicTexture(`dt-${m.id}`, { width: 512, height: 128 }, scene, false);
            const lmat = new StandardMaterial(`lmat-${m.id}`, scene);
            lmat.diffuseTexture = dt;
            lmat.emissiveColor = Color3.White();
            lmat.disableLighting = true;
            lmat.useAlphaFromDiffuseTexture = true;
            lmat.backFaceCulling = false;
            labelMesh.material = lmat;

            dt.drawText(m.name, null, 88, "bold 42px monospace", "#1e293b", "rgba(255,255,255,0.92)", true, true);

            meshMap.set(m.id, {
                box, labelMesh, dt, mat, lmat,
                prevW: m.width, prevH: m.height, prevD: m.depth,
                prevName: m.name, prevColor: m.color,
            });
        }

        // ── Helper: rebuild multi-select bounding box lines ─────────────────────
        function updateSelectionBox(masses, selectedIds) {
            if (selBoxMesh) { selBoxMesh.dispose(); selBoxMesh = null; }
            if (selectedIds.length < 2) return;

            const sel = masses.filter((m) => selectedIds.includes(m.id));
            let mnX = Infinity, mnY = Infinity, mnZ = Infinity;
            let mxX = -Infinity, mxY = -Infinity, mxZ = -Infinity;
            sel.forEach(({ position: [x, y, z], width: w, height: h, depth: d }) => {
                mnX = Math.min(mnX, x - w / 2); mxX = Math.max(mxX, x + w / 2);
                mnY = Math.min(mnY, y - h / 2); mxY = Math.max(mxY, y + h / 2);
                mnZ = Math.min(mnZ, z - d / 2); mxZ = Math.max(mxZ, z + d / 2);
            });
            const P = 0.22;
            mnX -= P; mxX += P; mnY -= P; mxY += P; mnZ -= P; mxZ += P;

            // 12 edges as line pairs
            const V = (x, y, z) => new Vector3(x, y, z);
            const lines = [
                // bottom
                [V(mnX, mnY, mnZ), V(mxX, mnY, mnZ)], [V(mxX, mnY, mnZ), V(mxX, mnY, mxZ)],
                [V(mxX, mnY, mxZ), V(mnX, mnY, mxZ)], [V(mnX, mnY, mxZ), V(mnX, mnY, mnZ)],
                // top
                [V(mnX, mxY, mnZ), V(mxX, mxY, mnZ)], [V(mxX, mxY, mnZ), V(mxX, mxY, mxZ)],
                [V(mxX, mxY, mxZ), V(mnX, mxY, mxZ)], [V(mnX, mxY, mxZ), V(mnX, mxY, mnZ)],
                // verticals
                [V(mnX, mnY, mnZ), V(mnX, mxY, mnZ)], [V(mxX, mnY, mnZ), V(mxX, mxY, mnZ)],
                [V(mxX, mnY, mxZ), V(mxX, mxY, mxZ)], [V(mnX, mnY, mxZ), V(mnX, mxY, mxZ)],
            ];
            selBoxMesh = MeshBuilder.CreateLineSystem("selbox", { lines }, scene);
            selBoxMesh.color = new Color3(0.98, 0.80, 0.08);
            selBoxMesh.isPickable = false;
        }

        // ── Main sync: Zustand store → Babylon scene ────────────────────────────
        function syncState(state) {
            const { masses, selectedIds, sunTime, isPlanView } = state;

            // Sun direction
            const t = (sunTime - 6) / 12;
            const sx = Math.cos(t * Math.PI - Math.PI / 2);
            const sy = -(Math.sin(t * Math.PI) * 0.9 + 0.1);
            const sz = -0.4;
            dirLight.direction = new Vector3(sx, sy, sz).normalize();
            dirLight.position = new Vector3(-sx * 90, Math.abs(sy) * 90, -sz * 90);

            // Plan view
            if (isPlanView) {
                camera.alpha = -Math.PI / 2;
                camera.beta = 0.01;
                camera.radius = 95;
                camera.detachControl();
            } else if (!grabRef.current) {
                camera.attachControl(true);
            }

            // ── AABB overlap detection ──────────────────────────────────────────
            const overlapping = new Set();
            for (let i = 0; i < masses.length; i++) {
                for (let j = i + 1; j < masses.length; j++) {
                    const a = masses[i], b = masses[j];
                    const EPS = 0.02;
                    const ox = Math.abs(a.position[0] - b.position[0]) < (a.width + b.width) / 2 - EPS;
                    const oy = Math.abs(a.position[1] - b.position[1]) < (a.height + b.height) / 2 - EPS;
                    const oz = Math.abs(a.position[2] - b.position[2]) < (a.depth + b.depth) / 2 - EPS;
                    if (ox && oy && oz) { overlapping.add(a.id); overlapping.add(b.id); }
                }
            }

            // FAR → boundary colour
            const floorArea = masses.reduce(
                (s, m) => s + m.width * m.depth * Math.ceil(m.height / FLOOR_H), 0
            );
            const far = masses.length ? floorArea / SITE.area : 0;
            boundary.color = far > FAR_LIMIT
                ? new Color3(0.94, 0.27, 0.27)
                : new Color3(0.23, 0.51, 1.00);

            // ── Remove meshes for deleted masses ────────────────────────────────
            const massIds = new Set(masses.map((m) => m.id));
            for (const [id, e] of meshMap) {
                if (!massIds.has(id)) {
                    hl.removeMesh(e.box);
                    shadowGen.removeShadowCaster(e.box);
                    e.labelMesh.dispose();
                    e.dt.dispose();
                    e.lmat.dispose();
                    e.mat.dispose();
                    e.box.dispose();
                    meshMap.delete(id);
                }
            }

            // ── Create or update meshes ─────────────────────────────────────────
            masses.forEach((m) => {
                const [px, py, pz] = m.position;

                if (!meshMap.has(m.id)) {
                    createMassMesh(m);
                } else {
                    const e = meshMap.get(m.id);
                    const sizeChanged = e.prevW !== m.width || e.prevH !== m.height || e.prevD !== m.depth;

                    if (sizeChanged) {
                        // Rebuild geometry — keeps bottom face fixed (position already correct from store)
                        hl.removeMesh(e.box);
                        shadowGen.removeShadowCaster(e.box);
                        e.labelMesh.parent = null; // detach before disposal
                        e.box.dispose();

                        const box = MeshBuilder.CreateBox(`box-${m.id}`, {
                            width: m.width, height: m.height, depth: m.depth,
                        }, scene);
                        box.position.set(px, py, pz);
                        box.metadata = { type: "mass", id: m.id };
                        box.receiveShadows = true;
                        box.material = e.mat;
                        shadowGen.addShadowCaster(box, true);

                        e.labelMesh.parent = box;
                        e.labelMesh.position.y = m.height / 2 + 1.4;
                        e.box = box;
                        e.prevW = m.width;
                        e.prevH = m.height;
                        e.prevD = m.depth;
                    } else {
                        // Just move
                        e.box.position.set(px, py, pz);
                    }

                    // Colour change
                    if (e.prevColor !== m.color) {
                        e.mat.diffuseColor = Color3.FromHexString(m.color);
                        e.prevColor = m.color;
                    }

                    // Name change → redraw label texture
                    if (e.prevName !== m.name) {
                        e.dt.drawText(m.name, null, 88, "bold 42px monospace", "#1e293b", "rgba(255,255,255,0.92)", true, true);
                        e.prevName = m.name;
                    }
                }

                // ── Highlight ─────────────────────────────────────────────────────
                const entry = meshMap.get(m.id);
                if (!entry) return;
                hl.removeMesh(entry.box);
                if (overlapping.has(m.id)) {
                    hl.addMesh(entry.box, Color3.FromHexString("#ef4444"));
                } else if (selectedIds.includes(m.id)) {
                    hl.addMesh(entry.box, Color3.FromHexString("#f97316"));
                }
            });

            // ── Multi-select bounding box ───────────────────────────────────────
            updateSelectionBox(masses, selectedIds);
        }

        // Run initial sync then subscribe
        syncState(useStore.getState());
        const unsubscribe = useStore.subscribe(syncState);

        // ── Pointer events ──────────────────────────────────────────────────────
        scene.onPointerObservable.add((pi) => {

            // ── POINTER DOWN ────────────────────────────────────────────────────
            if (pi.type === PointerEventTypes.POINTERDOWN) {
                ptrDownRef.current = { x: pi.event.clientX, y: pi.event.clientY, dragged: false };
            }

            // ── POINTER MOVE ────────────────────────────────────────────────────
            if (pi.type === PointerEventTypes.POINTERMOVE) {
                // Drag detection
                if (ptrDownRef.current) {
                    const dx = pi.event.clientX - ptrDownRef.current.x;
                    const dy = pi.event.clientY - ptrDownRef.current.y;
                    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX2) ptrDownRef.current.dragged = true;
                }

                // Grab mode — axis-aware raycasting
                if (grabRef.current) {
                    const { masses, _updateMass } = useStore.getState();
                    const m = masses.find((x) => x.id === grabRef.current.id);
                    if (!m) return;

                    const [cx, cy, cz] = m.position;
                    const axis = grabRef.current.axis;

                    // Build a plane through the mass centre facing the camera
                    const camFwd = camera.getForwardRay().direction;
                    const nx = camFwd.x, ny = camFwd.y, nz = camFwd.z;
                    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);

                    if (axis === "X") {
                        // Slide along world X — vertical plane facing camera (XZ projected)
                        const len = Math.sqrt(nz * nz + 0.0001);
                        const plane = Plane.FromPositionAndNormal(
                            new Vector3(cx, cy, cz),
                            new Vector3(0, 0, nz / len)
                        );
                        const dist = ray.intersectsPlane(plane);
                        if (dist !== null) {
                            const hit = ray.origin.add(ray.direction.scale(dist));
                            _updateMass(grabRef.current.id, { position: [Math.round(hit.x), cy, cz] });
                        }

                    } else if (axis === "Z") {
                        // Slide along world Z — vertical plane facing camera (XZ projected)
                        const len = Math.sqrt(nx * nx + 0.0001);
                        const plane = Plane.FromPositionAndNormal(
                            new Vector3(cx, cy, cz),
                            new Vector3(nx / len, 0, 0)
                        );
                        const dist = ray.intersectsPlane(plane);
                        if (dist !== null) {
                            const hit = ray.origin.add(ray.direction.scale(dist));
                            _updateMass(grabRef.current.id, { position: [cx, cy, Math.round(hit.z)] });
                        }

                    } else if (axis === "Y") {
                        // Slide along world Y — vertical plane facing camera (horizontal normal only)
                        const hLen = Math.sqrt(nx * nx + nz * nz) || 1;
                        const plane = Plane.FromPositionAndNormal(
                            new Vector3(cx, cy, cz),
                            new Vector3(nx / hLen, 0, nz / hLen)
                        );
                        const dist = ray.intersectsPlane(plane);
                        if (dist !== null) {
                            const hit = ray.origin.add(ray.direction.scale(dist));
                            _updateMass(grabRef.current.id, {
                                position: [cx, Math.max(m.height / 2, Math.round(hit.y)), cz],
                            });
                        }

                    } else {
                        // ── Free XYZ — camera-facing plane through mass centre ──────────
                        const fLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
                        const plane = Plane.FromPositionAndNormal(
                            new Vector3(cx, cy, cz),
                            new Vector3(nx / fLen, ny / fLen, nz / fLen)
                        );
                        const dist = ray.intersectsPlane(plane);
                        if (dist !== null) {
                            const hit = ray.origin.add(ray.direction.scale(dist));
                            _updateMass(grabRef.current.id, {
                                position: [Math.round(hit.x), Math.max(m.height / 2, Math.round(hit.y)), Math.round(hit.z)],
                            });
                        }
                    }
                }
            }

            // ── POINTER UP ──────────────────────────────────────────────────────
            if (pi.type === PointerEventTypes.POINTERUP) {
                const p = ptrDownRef.current;
                ptrDownRef.current = null;
                if (!p || p.dragged) return; // orbit drag — ignore

                // Confirm grab-move
                if (grabRef.current) {
                    const { masses } = useStore.getState();
                    const m = masses.find((x) => x.id === grabRef.current.id);
                    if (m) commandHistory.execute(
                        moveMassCmd(grabRef.current.id, grabRef.current.origPos, [...m.position])
                    );
                    grabRef.current = null;
                    camera.attachControl(true);
                    return;
                }

                // Pick what was clicked
                const pick = scene.pick(scene.pointerX, scene.pointerY);
                if (!pick?.hit) return;
                const hit = pick.pickedMesh;

                // ── Clicked a mass ───────────────────────────────────────────────
                if (hit?.metadata?.type === "mass") {
                    const massId = hit.metadata.id;
                    const { masses } = useStore.getState();
                    const mass = masses.find((x) => x.id === massId);
                    if (!mass) return;

                    if (shiftRef.current) {
                        // Shift+click mass → stack a new block on top
                        const topY = mass.position[1] + mass.height / 2;
                        const pt = pick.pickedPoint;
                        const newMass = createMassData({
                            position: [Math.round(pt.x), topY + DEFAULTS.height / 2, Math.round(pt.z)],
                        });
                        commandHistory.execute(addMassCmd(newMass));
                        useStore.getState().clearSelection();
                    } else {
                        // Plain click → select
                        useStore.getState().selectSingle(massId);
                    }
                    return;
                }

                // ── Clicked ground ───────────────────────────────────────────────
                if (hit?.name === "ground") {
                    const pt = pick.pickedPoint;
                    if (shiftRef.current) {
                        // Shift+click ground → place new block
                        const newMass = createMassData({
                            position: [Math.round(pt.x), DEFAULTS.height / 2, Math.round(pt.z)],
                        });
                        commandHistory.execute(addMassCmd(newMass));
                    } else {
                        // Plain click → deselect
                        useStore.getState().clearSelection();
                    }
                }
            }
        });

        // ── Keyboard shortcuts ──────────────────────────────────────────────────
        const onKeyDown = (e) => {
            const inInput = e.target.tagName === "INPUT";

            // Track shift (don't detach camera — rely on drag-threshold for discrimination)
            if (e.key === "Shift") shiftRef.current = true;

            // Delete selected
            if (!inInput && (e.key === "Delete" || e.key === "Backspace")) {
                const { masses, selectedIds } = useStore.getState();
                if (!selectedIds.length) return;
                commandHistory.execute(deleteMassesCmd(masses.filter((m) => selectedIds.includes(m.id))));
            }

            // Undo / Redo
            if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); commandHistory.undo(); }
            if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); commandHistory.redo(); }

            // G → enter grab / move mode (free XZ by default)
            if (!inInput && !e.ctrlKey && !grabRef.current && (e.key === "g" || e.key === "G")) {
                const { masses, selectedIds } = useStore.getState();
                if (selectedIds.length !== 1) return;
                const m = masses.find((x) => x.id === selectedIds[0]);
                if (!m) return;
                grabRef.current = { id: m.id, origPos: [...m.position], axis: null };
                camera.detachControl();
                return;
            }

            // While grabbing: X / Y / Z lock axis  (press again to free)
            if (grabRef.current && !inInput) {
                if (e.key === "x" || e.key === "X") {
                    grabRef.current.axis = grabRef.current.axis === "X" ? null : "X";
                    return;
                }
                if (e.key === "y" || e.key === "Y") {
                    grabRef.current.axis = grabRef.current.axis === "Y" ? null : "Y";
                    return;
                }
                if (e.key === "z" || e.key === "Z") {
                    grabRef.current.axis = grabRef.current.axis === "Z" ? null : "Z";
                    return;
                }
            }

            // Escape → cancel grab and restore original position
            if (e.key === "Escape" && grabRef.current) {
                useStore.getState()._updateMass(grabRef.current.id, { position: grabRef.current.origPos });
                grabRef.current = null;
                if (!useStore.getState().isPlanView) camera.attachControl(true);
            }
        };

        const onKeyUp = (e) => {
            if (e.key === "Shift") shiftRef.current = false;
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        // Prevent browser from intercepting wheel (page zoom) and right-click menu
        // on the canvas — Babylon needs these events exclusively.
        const onWheel = (e) => e.preventDefault();
        const onCtxMenu = (e) => e.preventDefault();
        canvas.addEventListener("wheel", onWheel, { passive: false });
        canvas.addEventListener("contextmenu", onCtxMenu, { passive: false });

        // ── Render loop ─────────────────────────────────────────────────────────
        engine.runRenderLoop(() => scene.render());

        const onResize = () => engine.resize();
        window.addEventListener("resize", onResize);

        // ── Cleanup ─────────────────────────────────────────────────────────────
        return () => {
            unsubscribe();
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("contextmenu", onCtxMenu);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("resize", onResize);
            engine.dispose();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            tabIndex={0}
            style={{
                width: "100%", height: "100%", display: "block", outline: "none",
                touchAction: "none",   /* blocks touch-scroll interfering with Babylon */
            }}
        />
    );
}