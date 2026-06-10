import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AccountCard } from "../../components/subscriptions/AccountCard";
import { CreateAccountModal } from "../../components/subscriptions/CreateAccountModal";
import { PlusCircle } from "lucide-react";
import { DEVNET_V2_PACKAGE_ID } from "../../constants";

interface AccountInfo {
  accountId: string;
  capId: string;
  denomination: string;
}

export function AccountsPage() {
  const account = useCurrentAccount();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: accountCreatedEvents, isPending } = useQuery({
    queryKey: ["account-created-events", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];
      const res = await fetch("https://fullnode.devnet.sui.io:443", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: [
            {
              MoveEventType: `${DEVNET_V2_PACKAGE_ID}::account::AccountCreated`,
              sender: account.address,
            },
            null,
            50,
            true,
          ],
        }),
      });
      const data = await res.json();
      return data.result?.data || [];
    },
    enabled: !!account?.address,
  });

  const accounts: AccountInfo[] = (accountCreatedEvents || []).map((e: any) => ({
    accountId: e.parsedJson.account_id,
    capId: e.parsedJson.cap_id,
    denomination: e.parsedJson.denomination || "0x2::sui::SUI",
  }));

  const uniqueAccounts = accounts.filter(
    (acc, idx, arr) => arr.findIndex((a) => a.accountId === acc.accountId) === idx
  );

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Connect your wallet to view accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your subscription accounts</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Account
        </Button>
      </div>

      {isPending ? (
        <div className="text-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : uniqueAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No accounts yet. Create one to get started.</p>
            <Button onClick={() => setModalOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {uniqueAccounts.map((acc) => (
            <AccountCard
              key={acc.accountId}
              accountId={acc.accountId}
              capId={acc.capId}
              denomination={acc.denomination}
            />
          ))}
        </div>
      )}

      <CreateAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
        }}
      />
    </div>
  );
}
