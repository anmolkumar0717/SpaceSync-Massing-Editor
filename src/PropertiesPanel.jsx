import { useState, useEffect, useRef } from "react";
import { useStore, FLOOR_H, DEFAULTS } from "./store";
import { commandHistory } from "./commandHistory";
import { updateMassCmd, deleteMassesCmd } from "./commands";

/* ── Shared styles ─────────────────────────────────────────────────────────── */
const css = {
    panel: {
        width: 220, flexShrink: 0,
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

    // Sync display values when selection changes
    useEffect(() => {
        if (!single) return;
        setW(single.width);
        setD(single.depth);
        setH(single.height);
        setName(single.name);
    }, [single?.id, single?.width, single?.depth, single?.height, single?.name]);

    if (!selected.length) {
        return (
            <div style={{ ...css.panel, justifyContent: "center", alignItems: "center" }}>
                <span style={{ color: "#1e2f44", fontSize: 11 }}>No selection</span>
            </div>
        );
    }

    /* ── Focus: capture original value (and position for height) ──────────── */
    const onFocus = (field) => {
        if (!single) return;
        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m) return;
        origRef.current[field] = { value: m[field], position: [...m.position] };
    };

    /**
     * Live preview: update store directly (no command yet).
     * Pivot-correct height:  newY = oldY + (newH - oldH) / 2
     * This keeps the bottom face fixed at its current Y regardless of stacking.
     */
    const onChange = (field, raw, setter) => {
        setter(raw);
        const v = Math.max(1, Number(raw) || 1);
        if (!single) return;
        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m) return;

        const diff = { [field]: v };
        if (field === "height") {
            const delta = v - m.height;
            diff.position = [m.position[0], m.position[1] + delta / 2, m.position[2]];
        }
        useStore.getState()._updateMass(single.id, diff);
    };

    /* ── Blur: commit command only if value actually changed ───────────────── */
    const onBlur = (field) => {
        const orig = origRef.current[field];
        if (!orig || !single) return;
        delete origRef.current[field];

        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m || m[field] === orig.value) return;

        const oldProps = { [field]: orig.value, position: orig.position };
        const newProps = { [field]: m[field], position: [...m.position] };
        commandHistory.execute(updateMassCmd(single.id, oldProps, newProps));
    };

    /* ── Name ───────────────────────────────────────────────────────────── */
    const onNameFocus = () => {
        if (!single) return;
        origRef.current.name = { value: single.name };
    };
    const onNameChange = (v) => {
        setName(v);
        if (single) useStore.getState()._updateMass(single.id, { name: v });
    };
    const onNameBlur = () => {
        const orig = origRef.current.name;
        if (!orig || !single) return;
        delete origRef.current.name;
        const m = useStore.getState().masses.find((x) => x.id === single.id);
        if (!m || m.name === orig.value) return;
        commandHistory.execute(updateMassCmd(single.id, { name: orig.value }, { name: m.name }));
    };

    /* ── Stats ──────────────────────────────────────────────────────────── */
    const floors = single ? Math.ceil(single.height / FLOOR_H) : 0;
    const footprint = single ? single.width * single.depth : 0;
    const gfa = footprint * floors;

    return (
        <div style={css.panel}>

            {/* Header */}
            <div style={{ ...css.section, background: "#0c1622" }}>
                <div style={{ color: "#3d5470", fontSize: 10, letterSpacing: "0.1em", marginBottom: 4 }}>
                    {single ? "PROPERTIES" : `${selected.length} SELECTED`}
                </div>
                {single ? (
                    <>
                        <div style={{ color: "#b8cfe0", fontSize: 13, fontWeight: "bold" }}>{single.name}</div>
                        <div style={{ color: "#3b82f6", fontSize: 11, marginTop: 3 }}>
                            {floors} fl · {footprint}m² · {gfa}m² GFA
                        </div>
                    </>
                ) : (
                    <div style={{ color: "#4a6888", fontSize: 12 }}>Select one to edit.</div>
                )}
            </div>

            {/* Name field (single only) */}
            {single && (
                <div style={css.section}>
                    <div style={css.row}>
                        <span style={css.label}>Name</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => onNameChange(e.target.value)}
                            onFocus={onNameFocus}
                            onBlur={onNameBlur}
                            style={{ ...css.input, borderColor: "#2a3f58" }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: 3, background: single.color }} />
                        <span style={{ color: "#3d5470", fontSize: 10 }}>{single.color}</span>
                    </div>
                </div>
            )}

            {/* Dimension fields (single only) */}
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
                                type="number" min={1} step={1}
                                value={val}
                                onChange={(e) => onChange(field, e.target.value, setter)}
                                onFocus={() => onFocus(field)}
                                onBlur={() => onBlur(field)}
                                style={css.input}
                            />
                        </div>
                    ))}

                    <div style={{ color: "#2d4460", fontSize: 10, marginTop: 2 }}>
                        ↳ height resize keeps base fixed
                    </div>
                </div>
            )}

            {/* Delete */}
            <div style={{ ...css.section, marginTop: "auto" }}>
                <button
                    style={css.btn(true)}
                    onClick={() => commandHistory.execute(deleteMassesCmd(selected))}
                >
                    ✕ Delete {selected.length > 1 ? `(${selected.length})` : ""}
                </button>
            </div>
        </div>
    );
}