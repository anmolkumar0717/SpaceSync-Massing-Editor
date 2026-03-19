
import { commandHistory } from "./CommandHistory";
import ExportButton from "./ExportButton";

export default function Toolbar() {
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, height: 42,
            background: "#0c1622",
            borderBottom: "1px solid #1a2a3e",
            display: "flex", alignItems: "center", padding: "0 16px", gap: 8,
            fontFamily: "monospace", fontSize: 12, zIndex: 10,
            userSelect: "none",
        }}>
            {/* Logo */}
            <div style={{ color: "#3b82f6", fontWeight: "bold", letterSpacing: "0.12em", marginRight: 16 }}>
                SPACE<span style={{ color: "#7eb5c4" }}>SYNC</span>
            </div>

            <Btn onClick={() => commandHistory.undo()} title="Undo (Ctrl+Z)">↩ Undo</Btn>
            <Btn onClick={() => commandHistory.redo()} title="Redo (Ctrl+Y)">↪ Redo</Btn>

            <div style={{ flex: 1 }} />
            <ExportButton />
        </div>
    );
}

function Btn({ onClick, title, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            style={{
                background: "transparent",
                border: "1px solid #1e2f44",
                borderRadius: 4,
                padding: "3px 12px",
                color: "#6a8aaa",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: 11,
            }}
        >
            {children}
        </button>
    );
}