import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { SWRConfig } from "swr";
import { fetcher } from "./lib/fetcher";
import { Toaster } from "./components/ui/toaster";
import Editor from "./pages/Editor";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ fetcher }}>
      <Switch>
        <Route path="/" component={Editor} />
        <Route>404 - Seite nicht gefunden</Route>
      </Switch>
      <Toaster />
    </SWRConfig>
  </StrictMode>,
);
