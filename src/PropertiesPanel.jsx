import { useState, useEffect, useRef, useMemo } from "react";
import { useStore, FLOOR_H, DEFAULTS, SITE, FAR_LIMIT } from "./store";
import { commandHistory } from "./CommandHistory";
import { updateMassCmd, deleteMassesCmd } from "./Commands";

/* ── Shared styles ────────────────────────────────────────────────────────── */
const css = {
    panel: {
        width: 232, flexShrink: 0,
        background: "#111b2b",
        borderLeft: "1px solid #1e2f44",
        display: "flex", flexDirection: "column",
        fontFamily: "monospace", fontSize: 12,
        overflowY: "auto",
    },
    section: { padding: "12px 14px", borderBottom: "1px solid #1a2a3e" },
    label: {
        display: "block", color: "#3d5470", fontSize: 10,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
    },
    input: {
        width: "100%",
        background: "#0c1622", border: "1px solid #1e2f44", borderRadius: 4,
        color: "#b8cfe0", padding: "5px 8px",
        fontFamily: "monospace", fontSize: 12,
        outline: "none", boxSizing: "border-box",
    },
    row: { marginBottom: 9 },
    btn: (danger) => ({
        width: "100%", padding: "6px 0", borderRadius: 4,
        border: danger ? "1px solid #7f1d1d" : "1px solid #1e2f44",
        background: danger ? "#3f0d0d" : "#0c1622",
        color: danger ? "#fca5a5" : "#6a8aaa",
        cursor: "pointer", fontFamily: "monospace", fontSize: 12,
        marginTop: 6,
    }),
};

/* ── Site Metrics ─────────────────────────────────────────────────────────── */
function SiteMetrics() {
    const masses = useStore((s) => s.masses);

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
    const farPct = Math.min((stats.far / FAR_LIMIT) * 100, 100);

    return (
        <div style={{ ...css.section, background: "#0c1622" }}>
            <div style={{ color: "#3d5470", fontSize: 10, letterSpacing: "0.1em", marginBottom: 10 }}>
                SITE METRICS
            </div>

            {/* FAR with progress bar */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ color: "#3d5470", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>FAR</span>
                    <span style={{ color: overFar ? "#ef4444" : "#7eb5c4", fontWeight: "bold", fontSize: 13 }}>
                        {stats.far.toFixed(2)}
                        <span style={{ color: "#3d5470", fontSize: 10, fontWeight: "normal", marginLeft: 4 }}>/ {FAR_LIMIT}</span>
                    </span>
                </div>
                <div style={{ height: 4, background: "#1a2a3e", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                        height: "100%", borderRadius: 2,
                        width: `${farPct}%`,
                        background: overFar ? "#ef4444" : "#3b82f6",
                        transition: "width 0.2s ease, background 0.2s ease",
                    }} />
                </div>
                {overFar && (
                    <div style={{ color: "#ef4444", fontSize: 10, marginTop: 4 }}>⚠ FAR limit exceeded</div>
                )}
            </div>

            {/* Stat rows */}
            {[
                ["Site Area", `${SITE.area} m²`, "#3d5470"],
                ["Footprint", `${stats.footprint} m²`, "#7eb5c4"],
                ["Floor Area", `${stats.floorArea} m²`, "#7eb5c4"],
                ["Masses", `${masses.length}`, "#7eb5c4"],
            ].map(([label, value, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                    <span style={{ color: "#3d5470", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                    <span style={{ color, fontSize: 12, fontWeight: "bold" }}>{value}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Main Panel ───────────────────────────────────────────────────────────── */
export default function PropertiesPanel() {
    const masses = useStore((s) => s.masses);
    const selectedIds = useStore((s) => s.selectedIds);

    const selected = masses.filter((m) => selectedIds.includes(m.id));
    const single = selected.length === 1 ? selected[0] : null;

    const [w, setW] = useState(DEFAULTS.width);
    const [d, setD] = useState(DEFAULTS.depth);
    const [h, setH] = useState(DEFAULTS.height);
    const [name, setName] = useState("");
    const origRef = useRef({});

    useEffect(() => {
        if (!single) return;
        setW(single.width);
        setD(single.depth);
        setH(single.height);
        setName(single.name);
    }, [single?.id, single?.width, single?.depth, single?.height, single?.name]);

    const onFocus = (field) => {
        const m = useStore.getState().masses.find((x) => x.id === single?.id);
        if (!m) return;
        origRef.current[field] = { value: m[field], position: [...m.position] };
    };

    // Live preview — pivot-correct height: newY = oldY + (newH - oldH) / 2
    const onChange = (field, raw, setter) => {
        setter(raw);
        const v = Math.max(1, Number(raw) || 1);
        const m = useStore.getState().masses.find((x) => x.id === single?.id);
        if (!m) return;
        const diff = { [field]: v };
        if (field === "height")
            diff.position = [m.position[0], m.position[1] + (v - m.height) / 2, m.position[2]];
        useStore.getState()._updateMass(single.id, diff);
    };

    const onBlur = (field) => {
        const orig = origRef.current[field];
        if (!orig || !single) return;
        delete origRef.current[field];
        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m || m[field] === orig.value) return;
        commandHistory.execute(updateMassCmd(
            single.id,
            { [field]: orig.value, position: orig.position },
            { [field]: m[field], position: [...m.position] },
        ));
    };

    const onNameFocus = () => { origRef.current.name = { value: single?.name }; };
    const onNameChange = (v) => { setName(v); if (single) useStore.getState()._updateMass(single.id, { name: v }); };
    const onNameBlur = () => {
        const orig = origRef.current.name;
        if (!orig || !single) return;
        delete origRef.current.name;
        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m || m.name === orig.value) return;
        commandHistory.execute(updateMassCmd(single.id, { name: orig.value }, { name: m.name }));
    };

    const floors = single ? Math.ceil(single.height / FLOOR_H) : 0;
    const footprint = single ? single.width * single.depth : 0;
    const gfa = footprint * floors;

    return (
        <div style={css.panel}>

            {/* Site metrics — always visible */}
            <SiteMetrics />

            {/* Selection header */}
            <div style={{ ...css.section, background: "#0f1825" }}>
                <div style={{ color: "#3d5470", fontSize: 10, letterSpacing: "0.1em", marginBottom: 4 }}>
                    {single ? "SELECTED BLOCK" : selected.length > 1 ? `${selected.length} SELECTED` : "PROPERTIES"}
                </div>
                {single ? (
                    <>
                        <div style={{ color: "#b8cfe0", fontSize: 13, fontWeight: "bold" }}>{single.name}</div>
                        <div style={{ color: "#3b82f6", fontSize: 11, marginTop: 3 }}>
                            {floors} fl · {footprint} m² · {gfa} m² GFA
                        </div>
                    </>
                ) : (
                    <div style={{ color: "#243550", fontSize: 11 }}>
                        {selected.length > 1 ? "Select one to edit dimensions." : "Click a block to select it."}
                    </div>
                )}
            </div>

            {/* Name */}
            {single && (
                <div style={css.section}>
                    <div style={css.row}>
                        <span style={css.label}>Name</span>
                        <input
                            type="text" value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            onFocus={onNameFocus} onBlur={onNameBlur}
                            style={{ ...css.input, borderColor: "#2a3f58" }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: single.color }} />
                        <span style={{ color: "#3d5470", fontSize: 10 }}>{single.color}</span>
                    </div>
                </div>
            )}

            {/* Dimensions */}
            {single && (
                <div style={css.section}>
                    <span style={{ ...css.label, color: "#2563eb", marginBottom: 10 }}>Dimensions (m)</span>
                    {[
                        ["Width (X)", "width", w, setW],
                        ["Depth (Z)", "depth", d, setD],
                        ["Height (Y)", "height", h, setH],
                    ].map(([lbl, field, val, setter]) => (
                        <div key={field} style={css.row}>
                            <span style={css.label}>{lbl}</span>
                            <input
                                type="number" min={1} step={1} value={val}
                                onChange={(e) => onChange(field, e.target.value, setter)}
                                onFocus={() => onFocus(field)}
                                onBlur={() => onBlur(field)}
                                style={css.input}
                            />
                        </div>
                    ))}
                    <div style={{ color: "#243550", fontSize: 10, marginTop: 2 }}>↳ height resize keeps base fixed</div>
                </div>
            )}

            {/* Controls hint */}
            <div style={{ ...css.section, marginTop: "auto" }}>
                <div style={{ color: "#3d5470", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>CONTROLS</div>
                {[
                    ["Click", "select block"],
                    ["Shift+Click", "add new block"],
                    ["G", "grab · free XYZ"],
                    ["G → X/Y/Z", "constrain axis"],
                    ["Del", "delete"],
                    ["Ctrl+Z / Y", "undo / redo"],
                ].map(([key, action]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#2563eb", fontSize: 10 }}>{key}</span>
                        <span style={{ color: "#243550", fontSize: 10 }}>{action}</span>
                    </div>
                ))}
            </div>

            {/* Delete button */}
            {selected.length > 0 && (
                <div style={{ padding: "10px 14px", borderTop: "1px solid #1a2a3e" }}>
                    <button
                        style={css.btn(true)}
                        onClick={() => commandHistory.execute(deleteMassesCmd(selected))}
                    >
                        ✕ Delete {selected.length > 1 ? `(${selected.length})` : ""}
                    </button>
                </div>
            )}
        </div>
    );
}