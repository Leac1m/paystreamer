import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useCurrentClient } from "@mysten/dapp-kit-react";
import { CreateAccount } from "./components/subscriptions/CreateAccount";
import { MySubscriptionAccount } from "./components/subscriptions/MySubscriptionAccount";
import { PlatformBrowser } from "./components/subscriptions/PlatformBrowser";
import { PlatformOwnerDashboard } from "./components/subscriptions/PlatformOwnerDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import NavBar from './components/NavBar';
import HeroSection from './components/HeroSection';
import IntegrationFlow from './components/IntegrationFlow';
import EndUserExperience from './components/EndUserExperience';
import CoreFeatures from './components/CoreFeatures';
import SecuritySection from './components/SecuritySection';
import CTASection from './components/CTASection';
import Footer from './components/Footer';
import { DEVNET_SUBSCRIPTIONS_PACKAGE_ID } from "./constants";

type Tab = "browse" | "my-account" | "owner";

export default function App() {
  const client = useCurrentClient();
  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountCapId, setAccountCapId] = useState<string | null>(null);

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

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Noise texture overlay */}
        <div className="noise" />

        {/* Navigation */}
        <NavBar />

        {/* Main Content */}
        <main>
          <HeroSection />
          <IntegrationFlow />
          <EndUserExperience />
          <CoreFeatures />
          <SecuritySection />
          <CTASection />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    );
  }

  if (capsPending) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="noise" />
        <NavBar />
        <main className="container mx-auto px-4 pt-32 pb-8">
          <div className="text-center py-12 text-white">Loading...</div>
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