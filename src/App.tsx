import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { CreateAccount } from "./components/subscriptions/CreateAccount";
import { MySubscriptionAccount } from "./components/subscriptions/MySubscriptionAccount";
import { PlatformBrowser } from "./components/subscriptions/PlatformBrowser";
import { PlatformOwnerDashboard } from "./components/subscriptions/PlatformOwnerDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import NavBar from "./components/NavBar";
import LandingPage from "./pages/LandingPage";
import SubscribePage from "./pages/SubscribePage";
import { AccountCardSkeleton } from "./components/ui/skeleton";
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from "./constants";

type Tab = "browse" | "my-account" | "owner";

export default function App() {
  const client = useCurrentClient();
  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountCapId, setAccountCapId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  // Query for existing AccountCap on wallet connection
  const { data: accountCaps, isPending: capsPending } = useQuery({
    queryKey: ["account-caps", currentAccount?.address],
    queryFn: async () => {
      if (!currentAccount?.address) return [];
      const { objects } = await client.core.listOwnedObjects({
        owner: currentAccount.address,
        type: `${DEVNET_SUBSCRIPTIONS_PACKAGE_ID}::subscription_account::AccountCap`,
        limit: 10,
        include: { json: true },
      });
      return objects;
    },
    enabled: !!currentAccount?.address,
  });

  // Restore account from existing AccountCap on mount
  useEffect(() => {
    if (capsPending || !accountCaps || accountCaps.length === 0) return;
    // Find AccountCap by checking object json (when codegen types are available)
    // For now, use the first object as placeholder - actual implementation
    // will use generated types to filter AccountCap objects
    const cap = accountCaps.find((o: any) => o.json && o.json.account_id);
    if (cap) {
      const json = cap.json as { account_id: string } | undefined;
      if (json?.account_id) {
        setAccountId(json.account_id);
        setAccountCapId(cap.objectId);
      }
    }
  }, [capsPending, accountCaps]);

  function handleAccountCreated(id: string, capId: string) {
    setAccountId(id);
    setAccountCapId(capId);
  }

  function handleAccountLost() {
    setAccountId(null);
    setAccountCapId(null);
  }

  if (currentPath === "/") {
    return <LandingPage />;
  }

  if (currentPath.startsWith("/subscribe/")) {
    return <SubscribePage />;
  }

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="noise" />
        <NavBar />
        <main className="container mx-auto px-4 pt-48 pb-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Connect Wallet to Continue</h2>
          <p className="text-[#94a3b8] mb-8">Please connect your wallet using the button in the top right to access the dashboard.</p>
        </main>
      </div>
    );
  }

  if (capsPending) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="noise" />
        <NavBar />
        <main className="container mx-auto px-4 pt-32 pb-8">
          <div className="space-y-6">
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </div>
        </main>
      </div>
    );
  }

  if (!accountId || !accountCapId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="noise" />
        <NavBar />
        <main className="container mx-auto px-4 pt-32 pb-8">
          <div className="mx-auto max-w-md space-y-6">
            <CreateAccount onCreated={handleAccountCreated} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="noise" />
      <NavBar />
      <main className="container mx-auto px-4 pt-32 pb-8">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
        >
          <TabsList className="mb-6 grid w-full grid-cols-3 bg-white/5 border border-white/10 text-white">
            <TabsTrigger value="browse" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">Browse Platforms</TabsTrigger>
            <TabsTrigger value="my-account" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">My Account</TabsTrigger>
            <TabsTrigger value="owner" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">Platform Owner</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <PlatformBrowser accountId={accountId} accountCapId={accountCapId} />
          </TabsContent>

          <TabsContent value="my-account">
            <MySubscriptionAccount
              accountId={accountId}
              accountCapId={accountCapId}
              onAccountLost={handleAccountLost}
            />
          </TabsContent>

          <TabsContent value="owner">
            <PlatformOwnerDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}