import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";

import App from "./App.tsx";
import { fetcher } from "./lib/fetcher.ts";
import { createSampleNotes } from "./sample/sampleNotes.ts";
import { useCanvasStore } from "./store/canvas.ts";
import "./index.css";

// No persistence yet: start every session from the sample board.
useCanvasStore.setState({ nodes: createSampleNotes() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
