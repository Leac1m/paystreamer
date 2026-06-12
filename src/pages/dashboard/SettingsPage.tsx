import { useState, useEffect } from "react";
import { useCurrentAccount, useCurrentClient, useDAppKit } from "@mysten/dapp-kit-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { DEVNET_V2_PACKAGE_ID, CLOCK_OBJECT_ID } from "../../constants";
import { parseMoveError } from "../../lib/errors";
import { TxStatusToast } from "../../components/TxStatusToast";
import { TxStatus } from "../../components/TxStatusToast";
import { AlertTriangle } from "lucide-react";

export function SettingsPage() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [notifications, setNotifications] = useState({
    payments: true,
    failures: true,
    marketing: false,
  });
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("paystreamer_display_name");
    if (saved) setDisplayName(saved);
    const notifs = localStorage.getItem("paystreamer_notifications");
    if (notifs) setNotifications(JSON.parse(notifs));
  }, []);

  function handleSaveName() {
    localStorage.setItem("paystreamer_display_name", displayName);
  }

  function handleSaveNotifications() {
    localStorage.setItem("paystreamer_notifications", JSON.stringify(notifications));
  }

  async function closeAccount(accountId: string, capId: string) {
    if (!account) return;
    if (!confirm("Are you sure you want to close this account? This action cannot be undone.")) {
      return;
    }

    setIsPending(true);
    setError(null);
    setTxStatus("pending");
    setTxMessage("Closing account...");

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::account::close_account`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [tx.object(capId), tx.object(accountId), tx.object(CLOCK_OBJECT_ID)],
      });

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      setTxStatus("success");
      setTxMessage("Account closed successfully");
      setTxDigest(result.Transaction.digest);
      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      await queryClient.invalidateQueries({ queryKey: ["subscription-accounts", account.address] });
    } catch (err) {
      setTxStatus("error");
      setTxMessage("Failed to close account");
      setError(parseMoveError(err));
    } finally {
      setIsPending(false);
    }
  }



  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Display Name</CardTitle>
          <CardDescription>How you appear in the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={handleSaveName}
          />
          <p className="text-xs text-muted-foreground">
            This is stored locally in your browser
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose what updates you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.payments}
              onChange={(e) =>
                setNotifications((prev) => ({ ...prev, payments: e.target.checked }))
              }
              onChangeCapture={handleSaveNotifications}
              className="w-4 h-4"
            />
            <span className="text-sm">Payment confirmations</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.failures}
              onChange={(e) =>
                setNotifications((prev) => ({ ...prev, failures: e.target.checked }))
              }
              onChangeCapture={handleSaveNotifications}
              className="w-4 h-4"
            />
            <span className="text-sm">Payment failures and alerts</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.marketing}
              onChange={(e) =>
                setNotifications((prev) => ({ ...prev, marketing: e.target.checked }))
              }
              onChangeCapture={handleSaveNotifications}
              className="w-4 h-4"
            />
            <span className="text-sm">Product updates and news</span>
          </label>
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-500">Danger Zone</CardTitle>
          </div>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm font-medium mb-2">Close Account</p>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently close your subscription account and withdraw any remaining
              funds to your wallet. This action cannot be undone.
            </p>
            <Button
              variant="outline"
              onClick={() => closeAccount("", "")}
              disabled={isPending}
              loading={isPending}
            >
              Close Account
            </Button>
          </div>
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <TxStatusToast
        status={txStatus}
        message={txMessage}
        digest={txDigest}
        onClose={() => setTxStatus("idle")}
      />
    </div>
  );
}
