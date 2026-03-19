import { useStore, FLOOR_H } from "./store";

export default function ExportButton() {
    const masses = useStore((s) => s.masses);

    const handleExport = () => {
        const data = masses.map((m) => {
            const floors = Math.ceil(m.height / FLOOR_H);
            const footprintArea = m.width * m.depth;
            return {
                id: m.id,
                name: m.name,
                position: { x: m.position[0], y: m.position[1], z: m.position[2] },
                dimensions: { w: m.width, d: m.depth, h: m.height },
                floors,
                footprintArea,
                floorArea: footprintArea * floors,
            };
        });

        const blob = new Blob([JSON.stringify({ masses: data }, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "spacesync-export.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <button
            onClick={handleExport}
            title="Export IFC-style JSON"
            style={{
                background: "transparent",
                border: "1px solid #1e2f44",
                borderRadius: 4,
                padding: "3px 10px",
                color: "#3d5470",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: 10,
            }}
        >
            ↓ JSON
        </button>
    );
}