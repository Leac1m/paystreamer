import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SubscribePage from "./pages/SubscribePage";
import { ExplorePage } from "./pages/ExplorePage";
import PricingPage from "./pages/PricingPage";

function PortalRedirect() {
  window.location.href = `http://localhost:5177${window.location.pathname}`;
  return null;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/dashboard/*" element={<PortalRedirect />} />
        <Route path="/platforms/*" element={<PortalRedirect />} />
        
        <Route path="/subscribe/:platformId" element={<SubscribePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Catch-all route for 404s */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
