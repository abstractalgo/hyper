import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";

import App from "./App.tsx";
import { fetcher } from "./lib/fetcher.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
