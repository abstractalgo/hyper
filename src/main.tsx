import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";

import App from "./App";
import { fetcher } from "./lib/fetcher";
import { useCanvasStore } from "./store/canvas";
import "./index.css";

// The board is saved in localStorage; on the very first visit, start from the sample. The sample
// builder (with Lexical's headless editor) is only loaded when it's needed.
if (!useCanvasStore.getState().initialized) {
  const { createSampleBoard } = await import("./sample/sampleNotes");
  useCanvasStore.getState().loadBoard(createSampleBoard());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
