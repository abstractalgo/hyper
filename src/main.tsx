import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";

import App from "./App";
import { fetcher } from "./lib/fetcher";
import { openWorkspace } from "./store/canvas";
import { activeWorkspace } from "./store/workspaces";
import "./index.css";

// Each workspace's board is saved in localStorage; a workspace opened for the first time starts
// from its sample, or empty.
await openWorkspace(activeWorkspace().id);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
