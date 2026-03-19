import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useStore } from "./store";
import * as THREE from "three";

export default function SelectionBox() {
    const selectedIds = useStore((s) => s.selectedIds);
    const masses = useStore((s) => s.masses);

    const result = useMemo(() => {
        const sel = masses.filter((m) => selectedIds.includes(m.id));
        if (sel.length < 2) return null; // only show for multi-select

        const box = new THREE.Box3();
        sel.forEach(({ position: [x, y, z], width, height, depth }) => {
            box.expandByPoint(new THREE.Vector3(x - width / 2, y - height / 2, z - depth / 2));
            box.expandByPoint(new THREE.Vector3(x + width / 2, y + height / 2, z + depth / 2));
        });

        const c = new THREE.Vector3();
        const s = new THREE.Vector3();
        box.getCenter(c);
        box.getSize(s);
        return { c, s };
    }, [masses, selectedIds]);

    if (!result) return null;

    const { c, s } = result;
    const P = 0.25; // padding
    const hw = s.x / 2 + P, hh = s.y / 2 + P, hd = s.z / 2 + P;
    const [x, y, z] = [c.x, c.y, c.z];

    // 12 edges of the box as line segments
    const points = [
        // bottom face
        [x - hw, y - hh, z - hd], [x + hw, y - hh, z - hd],
        [x + hw, y - hh, z - hd], [x + hw, y - hh, z + hd],
        [x + hw, y - hh, z + hd], [x - hw, y - hh, z + hd],
        [x - hw, y - hh, z + hd], [x - hw, y - hh, z - hd],
        // top face
        [x - hw, y + hh, z - hd], [x + hw, y + hh, z - hd],
        [x + hw, y + hh, z - hd], [x + hw, y + hh, z + hd],
        [x + hw, y + hh, z + hd], [x - hw, y + hh, z + hd],
        [x - hw, y + hh, z + hd], [x - hw, y + hh, z - hd],
        // verticals
        [x - hw, y - hh, z - hd], [x - hw, y + hh, z - hd],
        [x + hw, y - hh, z - hd], [x + hw, y + hh, z - hd],
        [x + hw, y - hh, z + hd], [x + hw, y + hh, z + hd],
        [x - hw, y - hh, z + hd], [x - hw, y + hh, z + hd],
    ].map((p) => new THREE.Vector3(...p));

    return <Line points={points} color="#facc15" lineWidth={2} />;
}