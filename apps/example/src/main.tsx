import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { dAppKit } from "./dApp-kit.ts";
import { PayStreamerProvider } from "@paystreamer/sdk/react";
import { CLOCK_OBJECT_ID } from "@paystreamer/sdk";

const queryClient = new QueryClient();

const paystreamerConfig = {
  clockId: CLOCK_OBJECT_ID,
  network: "localnet",
  graphqlUrl: "http://127.0.0.1:8000/graphql",
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <PayStreamerProvider config={paystreamerConfig}>
          <App />
        </PayStreamerProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
