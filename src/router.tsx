import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import { ExplorePage } from "./pages/ExplorePage";
import PricingPage from "./pages/PricingPage";

// Behind the local Caddy proxy (docker-compose's `caddy` service + Caddyfile),
// `*.paystreamer.localhost` subdomains route to each app's own dev server —
// matching production's subdomain layout. If Caddy isn't running (someone
// just ran `pnpm dev` directly on this app in isolation), fall back to the
// raw dev-server port instead.
function resolveDevRedirectBase(subdomain: string, rawPort: number): string {
  if (window.location.hostname.endsWith("paystreamer.localhost")) {
    return `http://${subdomain}.paystreamer.localhost`;
  }
  return `http://localhost:${rawPort}`;
}

function PortalRedirect() {
  const portalBase = import.meta.env.DEV ? resolveDevRedirectBase("app", 5177) : "https://app.usepaystreamer.xyz";
  window.location.href = `${portalBase}${window.location.pathname}`;
  return null;
}

function CheckoutRedirect() {
  const { platformId } = useParams<{ platformId: string }>();
  const checkoutBase = import.meta.env.DEV ? resolveDevRedirectBase("checkout", 5178) : "https://checkout-iota-mocha.vercel.app";
  window.location.href = `${checkoutBase}/${platformId}`;
  return null;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/dashboard/*" element={<PortalRedirect />} />
        <Route path="/platforms/*" element={<PortalRedirect />} />
        
        <Route path="/subscribe/:platformId" element={<CheckoutRedirect />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Catch-all route for 404s */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
