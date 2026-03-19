import { Canvas } from "@react-three/fiber";
import Scene from "./Scene";
import PropertiesPanel from "./PropertiesPanel";
import StatusBar from "./StatusBar";
import Toolbar from "./Toolbar";

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <Toolbar />

      {/* Main content below toolbar */}
      <div style={{ flex: 1, display: "flex", marginTop: 42, marginBottom: 38, overflow: "hidden" }}>
        {/* 3D viewport */}
        <div style={{ flex: 1, position: "relative" }}>
          <Canvas
            shadows
            camera={{ position: [35, 35, 55], fov: 45 }}
            style={{ width: "100%", height: "100%", background: "#1a2336" }}
            gl={{ antialias: true }}
          >
            <Scene />
          </Canvas>
        </div>

        {/* Properties panel */}
        <PropertiesPanel />
      </div>

      <StatusBar />
    </div>
  );
}