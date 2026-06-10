import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useCurrentAccount, useWalletConnection } from "@mysten/dapp-kit-react";
import { Menu, X, LayoutDashboard, Layers, Users, Wallet, Settings, Clock, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { NetworkBanner } from "../dashboard/NetworkBanner";
import { useOwnedPlatforms, PlatformObject } from "../../lib/platformDiscovery";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";

const NAV_ITEMS = [
  { path: "/platforms", label: "Overview", icon: LayoutDashboard },
  { path: "/platforms/tiers", label: "Tiers", icon: Layers },
  { path: "/platforms/subscribers", label: "Subscribers", icon: Users },
  { path: "/platforms/treasury", label: "Treasury", icon: Wallet },
  { path: "/platforms/settings", label: "Settings", icon: Settings },
  { path: "/platforms/scheduler", label: "Scheduler", icon: Clock },
];

export function PlatformPortalLayout() {
  const account = useCurrentAccount();
  const { isConnecting } = useWalletConnection();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformObject | null>(null);

  const { data: platforms } = useOwnedPlatforms(account?.address ?? null);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#94a3b8]" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <NetworkBanner />
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
            <p className="text-[#94a3b8]">Please connect your wallet to access the platform portal.</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <NetworkBanner />

      <div className="flex">
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold text-lg">Platform Portal</h2>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="h-5 w-5" />
            </button>
          </div>

          {platforms && platforms.length > 1 && (
            <div className="p-4 border-b">
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedPlatform?.objectId || ""}
                onChange={(e) => {
                  const platform = platforms.find(p => p.objectId === e.target.value);
                  setSelectedPlatform(platform || null);
                }}
              >
                <option value="">Select Platform</option>
                {platforms.map((p) => (
                  <option key={p.objectId} value={p.objectId}>
                    {p.json.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== "/platforms" && location.pathname.startsWith(item.path));

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 lg:ml-64">
          <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur border-b px-4 py-3 flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex-1">
              {platforms && platforms.length > 1 && (
                <Tabs
                  value={selectedPlatform?.objectId || platforms[0]?.objectId}
                  onValueChange={(id) => {
                    const platform = platforms.find(p => p.objectId === id);
                    setSelectedPlatform(platform || null);
                  }}
                  className="hidden md:block"
                >
                  <TabsList className="bg-white/5 border border-white/10">
                    {platforms.map((p) => (
                      <TabsTrigger
                        key={p.objectId}
                        value={p.objectId}
                        className="data-[state=active]:bg-white/10 data-[state=active]:text-white"
                      >
                        {p.json.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </div>
          </div>

          <div className="p-4 md:p-6">
            <Outlet context={{ platform: selectedPlatform || platforms?.[0] }} />
          </div>
        </main>
      </div>
    </div>
  );
}