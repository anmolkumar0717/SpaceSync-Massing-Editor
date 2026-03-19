import { useRef, useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { useStore, createMassData, DEFAULTS } from "./store";
import { commandHistory } from "./CommandHistory";
import { addMassCmd, deleteMassesCmd, moveMassCmd } from "./Commands";
import Ground from "./Ground";
import MassMesh from "./MassMesh";
import SelectionBox from "./SelectionBox";
import SiteBoundary from "./SiteBoundries";

// Infinite horizontal plane for grab-mode raycasting
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export default function Scene() {
    const orbitRef = useRef();
    const pointerRef = useRef(null); // shared drag-tracking across Ground + MassMesh
    const shiftRef = useRef(false); // reliable Shift state (e.shiftKey can be stale in R3F events)
    const { camera, gl } = useThree();

    const masses = useStore((s) => s.masses);
    const selectedIds = useStore((s) => s.selectedIds);
    const sunTime = useStore((s) => s.sunTime);
    const isPlanView = useStore((s) => s.isPlanView);
    const clearSelection = useStore((s) => s.clearSelection);
    const selectSingle = useStore((s) => s.selectSingle);
    const toggleSelect = useStore((s) => s.toggleSelect);

    // Grab (G-key move) state: { id, origPos }
    const [grabState, setGrabState] = useState(null);

    /* ── Sun position from time slider ───────────────────────────────────── */
    const sunPos = useMemo(() => {
        const t = (sunTime - 6) / 12; // 0..1 maps 6am→6pm
        return [
            Math.cos(t * Math.PI - Math.PI / 2) * 70,
            Math.sin(t * Math.PI) * 60 + 5,
            -40,
        ];
    }, [sunTime]);

    /* ── 3D AABB overlap detection ────────────────────────────────────────── */
    const overlappingIds = useMemo(() => {
        const ids = new Set();
        for (let i = 0; i < masses.length; i++) {
            for (let j = i + 1; j < masses.length; j++) {
                const a = masses[i], b = masses[j];
                const EPS = 0.02; // touching faces (stacked) don't count
                const ox = Math.abs(a.position[0] - b.position[0]) < (a.width + b.width) / 2 - EPS;
                const oy = Math.abs(a.position[1] - b.position[1]) < (a.height + b.height) / 2 - EPS;
                const oz = Math.abs(a.position[2] - b.position[2]) < (a.depth + b.depth) / 2 - EPS;
                if (ox && oy && oz) { ids.add(a.id); ids.add(b.id); }
            }
        }
        return ids;
    }, [masses]);

    /* ── Plan-view camera ─────────────────────────────────────────────────── */
    useEffect(() => {
        if (!orbitRef.current) return;
        if (isPlanView) {
            orbitRef.current.enabled = false;
            camera.position.set(0, 100, 0.001);
            camera.lookAt(0, 0, 0);
        } else if (!grabState) {
            orbitRef.current.enabled = true;
        }
    }, [isPlanView, grabState, camera]);

    /* ── Grab mode: live mouse move → snap to grid, click to confirm ────── */
    useEffect(() => {
        if (!grabState) return;

        const canvas = gl.domElement;
        const ray = new THREE.Raycaster();
        const mv = new THREE.Vector2();
        const pt = new THREE.Vector3();

        const onMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mv.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mv.y = ((e.clientY - rect.top) / rect.height) * -2 + 1;
            ray.setFromCamera(mv, camera);
            if (!ray.ray.intersectPlane(GROUND_PLANE, pt)) return;
            const { masses: ms, _updateMass } = useStore.getState();
            const m = ms.find((x) => x.id === grabState.id);
            if (!m) return;
            _updateMass(grabState.id, {
                position: [Math.round(pt.x), m.position[1], Math.round(pt.z)],
            });
        };

        const onConfirm = () => {
            const { masses: ms } = useStore.getState();
            const m = ms.find((x) => x.id === grabState.id);
            if (m) commandHistory.execute(moveMassCmd(grabState.id, grabState.origPos, [...m.position]));
            setGrabState(null);
            if (orbitRef.current && !isPlanView) orbitRef.current.enabled = true;
        };

        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("click", onConfirm, { once: true });
        return () => {
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("click", onConfirm);
        };
    }, [grabState, camera, gl, isPlanView]);

    /* ── Global keyboard shortcuts ────────────────────────────────────────── */
    useEffect(() => {
        const onKeyDown = (e) => {
            const inInput = e.target.tagName === "INPUT";

            // Shift held → track state + disable orbit so Shift+click reaches our handlers
            if (e.key === "Shift") {
                shiftRef.current = true;
                if (orbitRef.current && !isPlanView && !grabState)
                    orbitRef.current.enabled = false;
            }

            // Delete / Backspace → delete selected
            if (!inInput && (e.key === "Delete" || e.key === "Backspace")) {
                const { masses: ms, selectedIds: ids } = useStore.getState();
                if (!ids.length) return;
                const toDelete = ms.filter((m) => ids.includes(m.id));
                commandHistory.execute(deleteMassesCmd(toDelete));
            }

            // Ctrl+Z → undo
            if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); commandHistory.undo(); }
            // Ctrl+Y or Ctrl+Shift+Z → redo
            if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); commandHistory.redo(); }

            // G → enter grab mode for single-selected mass
            if (!inInput && !e.ctrlKey && !grabState && (e.key === "g" || e.key === "G")) {
                const { masses: ms, selectedIds: ids } = useStore.getState();
                if (ids.length !== 1) return;
                const m = ms.find((x) => x.id === ids[0]);
                if (!m) return;
                setGrabState({ id: m.id, origPos: [...m.position] });
                if (orbitRef.current) orbitRef.current.enabled = false;
            }

            // Escape → cancel grab
            if (e.key === "Escape" && grabState) {
                useStore.getState()._updateMass(grabState.id, { position: grabState.origPos });
                setGrabState(null);
                if (orbitRef.current && !isPlanView) orbitRef.current.enabled = true;
            }
        };

        const onKeyUp = (e) => {
            if (e.key === "Shift") {
                shiftRef.current = false;
                if (orbitRef.current && !grabState && !isPlanView)
                    orbitRef.current.enabled = true;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [grabState, isPlanView]);

    /* ── Ground click ─────────────────────────────────────────────────────── */
    // Plain click  → deselect everything
    // Shift+click  → place new block on ground at that point
    const handleGroundClick = (point) => {
        if (shiftRef.current) {
            const mass = createMassData({
                position: [Math.round(point.x), DEFAULTS.height / 2, Math.round(point.z)],
            });
            commandHistory.execute(addMassCmd(mass));
        } else {
            clearSelection();
        }
    };

    /* ── Mass click ───────────────────────────────────────────────────────── */
    // Plain click  → select that mass
    // Shift+click  → place new block on top (stacking)
    const handleMassClick = (e, mass, faceNormalY) => {
        if (grabState) return;

        if (shiftRef.current) {
            const topY = mass.position[1] + mass.height / 2;
            const newMass = createMassData({
                position: [Math.round(e.point.x), topY + DEFAULTS.height / 2, Math.round(e.point.z)],
            });
            commandHistory.execute(addMassCmd(newMass));
            clearSelection();
            return;
        }

        selectSingle(mass.id);
    };

    /* ── Render ───────────────────────────────────────────────────────────── */
    return (
        <>
            <OrbitControls
                ref={orbitRef}
                makeDefault
                maxPolarAngle={Math.PI / 2.05}
                minDistance={3}
                maxDistance={250}
            />

            {/* Lighting */}
            <ambientLight intensity={0.4} color="#dde8ff" />
            <directionalLight
                position={sunPos}
                intensity={1.5}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                shadow-camera-near={0.5}
                shadow-camera-far={350}
            />
            <hemisphereLight skyColor="#cfe0ff" groundColor="#c4bfb0" intensity={0.3} />

            {/* Ground + 1m grid + axis */}
            <Ground pointerRef={pointerRef} onGroundClick={handleGroundClick} />
            <gridHelper args={[400, 400, "#c0c8d0", "#dde1e7"]} position={[0, 0.003, 0]} />
            <axesHelper args={[8]} position={[0, 0.01, 0]} />

            {/* 50×40m site boundary */}
            <SiteBoundary />

            {/* Building masses */}
            {masses.map((m) => (
                <MassMesh
                    key={m.id}
                    mass={m}
                    isSelected={selectedIds.includes(m.id)}
                    isOverlapping={overlappingIds.has(m.id)}
                    pointerRef={pointerRef}
                    onMassClick={handleMassClick}
                />
            ))}

            {/* Multi-select bounding box */}
            <SelectionBox />
        </>
    );
}
