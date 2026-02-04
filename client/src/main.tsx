import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { KBStoreProvider } from "./lib/kbStore";

createRoot(document.getElementById("root")!).render(
  <KBStoreProvider>
    <App />
  </KBStoreProvider>,
);
