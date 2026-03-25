import { useStore } from "./store";

export default function StatusBar() {
    const isPlanView = useStore((s) => s.isPlanView);
    const setPlanView = useStore((s) => s.setPlanView);
    const sunTime = useStore((s) => s.sunTime);
    const setSunTime = useStore((s) => s.setSunTime);

    const h = Math.floor(sunTime);
    const min = sunTime % 1 === 0.5 ? "30" : "00";
    const ampm = h < 12 ? "am" : "pm";
    const label = `${h}:${min} ${ampm}`;

    return (
        <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            height: 36,
            background: "#0c1622",
            borderTop: "1px solid #1a2a3e",
            display: "flex", alignItems: "center",
            padding: "0 16px", gap: 12,
            fontFamily: "monospace", fontSize: 11,
            userSelect: "none", zIndex: 10,
        }}>
            <span style={{ color: "#3d5470", fontSize: 10, whiteSpace: "nowrap" }}>
                ☀ {label}
            </span>
            <input
                type="range" min={6} max={18} step={0.5}
                value={sunTime}
                onChange={(e) => setSunTime(Number(e.target.value))}
                style={{ width: 100, accentColor: "#f59e0b", cursor: "pointer" }}
            />

            <div style={{ flex: 1 }} />

            <button
                onClick={() => setPlanView(!isPlanView)}
                style={{
                    background: isPlanView ? "#1e3a5f" : "transparent",
                    border: "1px solid",
                    borderColor: isPlanView ? "#3b82f6" : "#1e2f44",
                    borderRadius: 4, padding: "3px 12px",
                    color: isPlanView ? "#93c5fd" : "#3d5470",
                    cursor: "pointer", fontFamily: "monospace", fontSize: 10,
                }}
            >
                {isPlanView ? "↗ 3D View" : "⊞ Plan View"}
            </button>
        </div>
    );
}