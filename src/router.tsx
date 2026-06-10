import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import NavBar from "./components/NavBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Card, CardContent } from "./components/ui/card";
import {
  NoAccountsEmpty,
  NoSubscriptionsEmpty,
  NoActivityEmpty,
  NoPlatformsEmpty,
  NoTiersEmpty,
  NoSubscribersEmpty,
} from "./components/ui/empty-state";

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

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="noise" />
      <NavBar />
      <main>
        <div className="pt-48 pb-8 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">PayStreamer</h1>
          <p className="text-[#94a3b8] text-lg">Streaming payments on Sui</p>
        </div>
      </main>
    </div>
  );
}

function AccountsPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">My Accounts</h2>
        <Card>
          <CardContent className="p-6">
            <NoAccountsEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function SubscriptionsPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">My Subscriptions</h2>
        <Card>
          <CardContent className="p-6">
            <NoSubscriptionsEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function ActivityPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">Activity</h2>
        <Card>
          <CardContent className="p-6">
            <NoActivityEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function SettingsPage() {
  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <p className="text-[#94a3b8]">Manage your account settings</p>
    </div>
  );
}

function PlatformOverviewPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">Platform Overview</h2>
        <Card>
          <CardContent className="p-6">
            <NoPlatformsEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function TiersPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">Subscription Tiers</h2>
        <Card>
          <CardContent className="p-6">
            <NoTiersEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function SubscribersPage() {
  return (
    <ErrorBoundary>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4">Subscribers</h2>
        <Card>
          <CardContent className="p-6">
            <NoSubscribersEmpty />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

function TreasuryPage() {
  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Treasury</h2>
      <p className="text-[#94a3b8]">View your platform treasury</p>
    </div>
  );
}

function PlatformSettingsPage() {
  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Platform Settings</h2>
      <p className="text-[#94a3b8]">Configure your platform settings</p>
    </div>
  );
}

function SchedulerPage() {
  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Payment Scheduler</h2>
      <p className="text-[#94a3b8]">Monitor and manage payment scheduling</p>
    </div>
  );
}

function SubscribePage() {
  return (
    <div className="text-white">
      <h2 className="text-2xl font-bold mb-4">Subscribe</h2>
      <p className="text-[#94a3b8]">Subscribe to a platform</p>
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