import { useRef, useEffect } from "react";
import { Html } from "@react-three/drei";

/**
 * MassMesh — single building mass.
 * Captures face normal on pointerDown so Scene can decide top-face vs side click.
 * Uses shared pointerRef for drag-vs-click discrimination (same pattern as Ground).
 */
export default function MassMesh({
    mass,
    isSelected,
    isOverlapping,
    pointerRef,
    onMassClick,   // called as onMassClick(e, mass, faceNormalY)
}) {
    const meshRef = useRef();
    const faceNormalY = useRef(0);

    // Keep userData synced for external access
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.userData = { type: "mass", id: mass.id };
        }
    }, [mass.id]);

    // Priority: overlap red > selected orange > default black
    const emissive = isOverlapping ? "#880000" : isSelected ? "#7a3500" : "#000000";
    const emissiveIntensity = isOverlapping ? 0.6 : isSelected ? 0.45 : 0;

    return (
        <mesh
            ref={meshRef}
            position={mass.position}
            castShadow
            receiveShadow
            onPointerDown={(e) => {
                e.stopPropagation();
                pointerRef.current = {
                    x: e.clientX, y: e.clientY,
                    dragged: false, source: "mass",
                };
                // Capture face normal in world space for top-face detection
                if (e.face && meshRef.current) {
                    const n = e.face.normal.clone().transformDirection(meshRef.current.matrixWorld);
                    faceNormalY.current = n.y;
                }
            }}
            onPointerMove={(e) => {
                if (!pointerRef.current) return;
                const dx = e.clientX - pointerRef.current.x;
                const dy = e.clientY - pointerRef.current.y;
                if (dx * dx + dy * dy > 25) pointerRef.current.dragged = true;
            }}
            onPointerUp={(e) => {
                e.stopPropagation();
                const p = pointerRef.current;
                if (!p || p.source !== "mass" || p.dragged) return;
                onMassClick(e, mass, faceNormalY.current);
            }}
        >
            <boxGeometry args={[mass.width, mass.height, mass.depth]} />
            <meshStandardMaterial
                color={mass.color}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity}
                roughness={0.55}
                metalness={0.08}
            />

            {/* Billboard name label — always faces camera */}
            <Html
                position={[0, mass.height / 2 + 0.7, 0]}
                center
                distanceFactor={40}
                style={{
                    pointerEvents: "none",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                    color: "#1e293b",
                    background: "rgba(255,255,255,0.88)",
                    padding: "1px 6px",
                    borderRadius: "3px",
                    border: isSelected
                        ? "1px solid #f97316"
                        : isOverlapping
                            ? "1px solid #ef4444"
                            : "1px solid rgba(0,0,0,0.12)",
                }}
            >
                {mass.name}
            </Html>
        </mesh>
    );
}