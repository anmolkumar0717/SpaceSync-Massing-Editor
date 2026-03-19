/**
 * Ground plane.
 * Uses a shared pointerRef to discriminate drag vs click:
 *   source:'ground' + not dragged → triggers onGroundClick
 */
export default function Ground({ pointerRef, onGroundClick }) {
    return (
        <mesh
            name="ground"
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
            onPointerDown={(e) => {
                e.stopPropagation();
                pointerRef.current = {
                    x: e.clientX, y: e.clientY,
                    dragged: false, source: "ground",
                };
            }}
            onPointerMove={(e) => {
                if (!pointerRef.current) return;
                const dx = e.clientX - pointerRef.current.x;
                const dy = e.clientY - pointerRef.current.y;
                if (dx * dx + dy * dy > 25) pointerRef.current.dragged = true; // 5px²
            }}
            onPointerUp={(e) => {
                const p = pointerRef.current;
                if (!p || p.source !== "ground" || p.dragged) return;
                onGroundClick(e.point, e.shiftKey);
            }}
        >
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color="#dde1e7" roughness={0.95} metalness={0} />
        </mesh>
    );
}