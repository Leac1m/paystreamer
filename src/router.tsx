import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import NavBar from "./components/NavBar";
import LandingPage from "./pages/LandingPage";
import { AccountsPage } from "./pages/dashboard/AccountsPage";
import { SubscriptionsPage } from "./pages/dashboard/SubscriptionsPage";
import { ActivityPage } from "./pages/dashboard/ActivityPage";
import { SettingsPage } from "./pages/dashboard/SettingsPage";
import { PlatformOverviewPage } from "./pages/platforms/PlatformOverviewPage";
import { TiersPage } from "./pages/platforms/TiersPage";
import { SubscribersPage } from "./pages/platforms/SubscribersPage";
import { TreasuryPage } from "./pages/platforms/TreasuryPage";
import { PlatformSettingsPage } from "./pages/platforms/PlatformSettingsPage";
import { SchedulerPage } from "./pages/platforms/SchedulerPage";
import SubscribePage from "./pages/SubscribePage";

function DashboardLayout() {
  const account = useCurrentAccount();
  const location = useLocation();

  if (!account) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="noise" />
      <NavBar />
      <main className="container mx-auto px-4 pt-32 pb-8">
        <Outlet />
      </main>
    </div>
  );
}

function PlatformPortalLayout() {
  const account = useCurrentAccount();
  const location = useLocation();

  if (!account) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="noise" />
      <NavBar />
      <main className="container mx-auto px-4 pt-32 pb-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard/accounts" element={<AccountsPage />} />
          <Route path="/dashboard/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/dashboard/activity" element={<ActivityPage />} />
          <Route path="/dashboard/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<PlatformPortalLayout />}>
          <Route path="/platforms/overview" element={<PlatformOverviewPage />} />
          <Route path="/platforms/tiers" element={<TiersPage />} />
          <Route path="/platforms/subscribers" element={<SubscribersPage />} />
          <Route path="/platforms/treasury" element={<TreasuryPage />} />
          <Route path="/platforms/settings" element={<PlatformSettingsPage />} />
          <Route path="/platforms/scheduler" element={<SchedulerPage />} />
        </Route>
        <Route path="/subscribe/:platformId" element={<SubscribePage />} />
      </Routes>
    </BrowserRouter>
  );
}
