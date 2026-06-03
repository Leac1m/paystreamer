import { useState } from "react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { CreateAccount } from "./components/subscriptions/CreateAccount";
import { MySubscriptionAccount } from "./components/subscriptions/MySubscriptionAccount";
import { PlatformBrowser } from "./components/subscriptions/PlatformBrowser";
import { PlatformOwnerDashboard } from "./components/subscriptions/PlatformOwnerDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

type Tab = "browse" | "my-account" | "owner";

function App() {
  const currentAccount = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [hasAccount, setHasAccount] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountCapId, setAccountCapId] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Sui Subscriptions</h1>
          <ConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!currentAccount ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connect Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Connect your wallet to create subscription accounts and subscribe
                to platforms on Sui.
              </p>
            </CardContent>
          </Card>
        ) : !hasAccount ? (
          <div className="mx-auto max-w-md space-y-6">
            <CreateAccount
              onCreated={(id, capId) => {
                setAccountId(id);
                setAccountCapId(capId);
                setHasAccount(true);
              }}
            />
          </div>
        ) : accountId && accountCapId ? (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
          >
            <TabsList className="mb-6 grid w-full grid-cols-3">
              <TabsTrigger value="browse">Browse Platforms</TabsTrigger>
              <TabsTrigger value="my-account">My Account</TabsTrigger>
              <TabsTrigger value="owner">Platform Owner</TabsTrigger>
            </TabsList>

            <TabsContent value="browse">
              <PlatformBrowser />
            </TabsContent>

            <TabsContent value="my-account">
              <MySubscriptionAccount
                accountId={accountId}
                accountCapId={accountCapId}
                onAccountLost={() => setHasAccount(false)}
              />
            </TabsContent>

            <TabsContent value="owner">
              <PlatformOwnerDashboard />
            </TabsContent>
          </Tabs>
        ) : null}
      </main>
    </div>
  );
}

export default App;
