import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useStore, SITE, FLOOR_H, FAR_LIMIT } from "./store";

const HW = SITE.w / 2; // 25
const HD = SITE.d / 2; // 20
const Y = 0.01;

// Closed rectangle corners
const LOOP = [
    [-HW, Y, -HD], [HW, Y, -HD],
    [HW, Y, HD], [-HW, Y, HD],
    [-HW, Y, -HD],
].map(([x, y, z]) => [x, y, z]);

export default function SiteBoundary() {
    const masses = useStore((s) => s.masses);

    const far = useMemo(() => {
        if (!masses.length) return 0;
        return masses.reduce((sum, m) => {
            const floors = Math.ceil(m.height / FLOOR_H);
            return sum + m.width * m.depth * floors;
        }, 0) / SITE.area;
    }, [masses]);

    const over = far > FAR_LIMIT;

    return (
        <Line
            points={LOOP}
            color={over ? "#ef4444" : "#3b82f6"}
            lineWidth={over ? 3.5 : 2}
        />
    );
}