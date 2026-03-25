import BabylonScene from "./BabylonScene";
import PropertiesPanel from "./PropertiesPanel";
import StatusBar from "./StatusBar";
import Toolbar from "./ToolBar";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <Toolbar />

      <div style={{ flex: 1, display: "flex", marginTop: 42, marginBottom: 36, overflow: "hidden" }}>
        {/* 3D viewport — Babylon renders into this canvas */}
        <div style={{ flex: 1, position: "relative", background: "#1a2336" }}>
          <BabylonScene />
        </div>

        <PropertiesPanel />
      </div>

      <StatusBar />
    </div>
  );
}