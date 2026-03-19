import { useMemo } from "react";
import { useStore, SITE, FLOOR_H, FAR_LIMIT } from "./store";

export default function StatusBar() {
    const masses = useStore((s) => s.masses);
    const isPlanView = useStore((s) => s.isPlanView);
    const setPlanView = useStore((s) => s.setPlanView);
    const sunTime = useStore((s) => s.sunTime);
    const setSunTime = useStore((s) => s.setSunTime);

    const stats = useMemo(() => {
        if (!masses.length) return { footprint: 0, floorArea: 0, far: 0 };
        let footprint = 0, floorArea = 0;
        masses.forEach((m) => {
            const fp = m.width * m.depth;
            const floors = Math.ceil(m.height / FLOOR_H);
            footprint += fp;
            floorArea += fp * floors;
        });
        return { footprint, floorArea, far: floorArea / SITE.area };
    }, [masses]);

    const overFar = stats.far > FAR_LIMIT;

    const timeLabel = () => {
        const h = Math.floor(sunTime);
        const m = sunTime % 1 === 0.5 ? "30" : "00";
        return `${h}:${m} ${h < 12 ? "am" : "pm"}`;
    };

    return (
        <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#0c1622",
            borderTop: "1px solid #1a2a3e",
            display: "flex", alignItems: "center", gap: 0,
            fontFamily: "monospace", fontSize: 11,
            height: 38, padding: "0 16px",
            userSelect: "none", zIndex: 10,
        }}>
            {/* Site area */}
            <Stat label="SITE" value={`${SITE.area} m²`} />
            <Div />
            <Stat label="FOOTPRINT" value={`${stats.footprint} m²`} />
            <Div />
            <Stat label="FLOOR AREA" value={`${stats.floorArea} m²`} />
            <Div />
            <Stat
                label="FAR"
                value={stats.far.toFixed(2)}
                alert={overFar}
                sub={overFar ? `⚠ LIMIT ${FAR_LIMIT}` : `/ ${FAR_LIMIT}`}
            />
            <Div />
            <Stat label="MASSES" value={masses.length} />

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Sun slider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#3d5470", fontSize: 10 }}>☀ {timeLabel()}</span>
                <input
                    type="range" min={6} max={18} step={0.5}
                    value={sunTime}
                    onChange={(e) => setSunTime(Number(e.target.value))}
                    style={{ width: 90, accentColor: "#f59e0b" }}
                />
            </div>

            <Div />

            {/* Plan view toggle */}
            <button
                onClick={() => setPlanView(!isPlanView)}
                style={{
                    background: isPlanView ? "#1e3a5f" : "transparent",
                    border: "1px solid",
                    borderColor: isPlanView ? "#3b82f6" : "#1e2f44",
                    borderRadius: 4, padding: "3px 10px",
                    color: isPlanView ? "#93c5fd" : "#3d5470",
                    cursor: "pointer", fontFamily: "monospace", fontSize: 10,
                }}
            >
                {isPlanView ? "⊞ 3D VIEW" : "⊞ PLAN VIEW"}
            </button>

            <Div />

            {/* Keyboard hint */}
            <span style={{ color: "#1e2f44", fontSize: 10 }}>
                G move · Del delete · Ctrl+Z undo · Shift+click multi
            </span>
        </div>
    );
}

function Stat({ label, value, alert, sub }) {
    return (
        <div style={{ padding: "0 14px" }}>
            <span style={{ color: "#3d5470", fontSize: 9, letterSpacing: "0.08em" }}>{label} </span>
            <span style={{ color: alert ? "#ef4444" : "#7eb5c4", fontWeight: "bold" }}>{value}</span>
            {sub && <span style={{ color: alert ? "#ef4444" : "#3d5470", fontSize: 9, marginLeft: 4 }}>{sub}</span>}
        </div>
    );
}

function Div() {
    return <div style={{ width: 1, height: 18, background: "#1a2a3e" }} />;
}