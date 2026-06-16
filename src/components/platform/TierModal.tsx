import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "../ui/modal";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { V3_PACKAGE_ID } from "../../constants";
import { getErrorMessage } from "../../lib/errors";

interface TierModalProps {
  open: boolean;
  onClose: () => void;
  platformId: string;
  initialSharedVersion: number;
  tier?: {
    name: string;
    amount: string;
    frequency: string;
    subscriber_count: number;
    is_active: boolean;
  };
  tierIndex?: number;
}

type BillingCycle = "daily" | "weekly" | "monthly" | "yearly" | "custom";

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom (Seconds)",
};

const BILLING_CYCLE_SECONDS: Record<BillingCycle, number> = {
  daily: 86400,
  weekly: 604800,
  monthly: 2592000,
  yearly: 31536000,
  custom: 0,
};

export function TierModal({ open, onClose, platformId, initialSharedVersion, tier, tierIndex: _tierIndex }: TierModalProps) {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const queryClient = useQueryClient();

  const [name, setName] = useState(tier?.name ?? "");
  const [amount, setAmount] = useState(
    tier ? (Number(tier.amount) / 1_000_000_000).toString() : ""
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [customSeconds, setCustomSeconds] = useState("30");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 60-second frequency exists specifically so the "Process Now" button (Phase 1.1)
  // can be demoed end-to-end inside a 5-minute window for the live hackathon demo.
  const [useDemoDefaults, setUseDemoDefaults] = useState(false);

  const isEditMode = !!tier;

  function handleDemoToggle(checked: boolean) {
    setUseDemoDefaults(checked);
    if (checked) {
      setName("Demo Tier (1-minute billing)");
      setAmount("0.001");
      setBillingCycle("custom");
      setCustomSeconds("60");
    } else {
      setName("");
      setAmount("");
      setBillingCycle("monthly");
      setCustomSeconds("30");
    }
  }

  const frequencySeconds =
    billingCycle === "custom"
      ? parseInt(customSeconds) * 1000
      : BILLING_CYCLE_SECONDS[billingCycle] * 1000;

  const previewAmount = amount
    ? `$${parseFloat(amount).toFixed(2)} USD/${BILLING_CYCLE_LABELS[billingCycle].toLowerCase()}`
    : "";

  async function handleSubmit() {
    if (!account || !name || !amount) {
      setError("Please fill in all required fields");
      return;
    }

    setIsPending(true);
    setError(null);

    const tx = new Transaction();
    const amountU64 = BigInt(Math.round(parseFloat(amount) * 1_000_000_000));

    tx.moveCall({
      target: `${V3_PACKAGE_ID}::platform::create_tier`,
      arguments: [
        tx.sharedObjectRef({
          objectId: platformId,
          initialSharedVersion,
          mutable: true,
        }),
        tx.pure.string(name),
        tx.pure.u64(amountU64),
        tx.pure.u64(frequencySeconds),
      ],
    });

    try {
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
      if (result.$kind === "FailedTransaction") {
        throw new Error(
          (result.FailedTransaction as any).effects?.status?.error ?? "Transaction failed"
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["owned-platforms", account.address] });
      onClose();
      resetForm();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  function resetForm() {
    setName("");
    setAmount("");
    setBillingCycle("monthly");
    setCustomSeconds("30");
    setUseDemoDefaults(false);
  }

  return (
    <Modal open={open} onOpenChange={(openValue) => !openValue && onClose()}>
      <ModalContent className="sm:max-w-lg mx-4">
        <ModalHeader>
          <ModalTitle>{isEditMode ? "Edit Tier" : "Add New Tier"}</ModalTitle>
          <ModalDescription>
            {isEditMode
              ? "Update the subscription tier details."
              : "Create a new subscription tier for your platform."}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          {!isEditMode && (
            <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-[#6c63ff]/40 bg-[#6c63ff]/5 p-3">
              <input
                type="checkbox"
                checked={useDemoDefaults}
                onChange={(e) => handleDemoToggle(e.target.checked)}
                className="w-4 h-4"
              />
              <div>
                <span className="text-sm font-medium">Use demo defaults</span>
                <p className="text-xs text-muted-foreground">
                  Pre-fills a 60-second billing cycle so the live "Process Now" button can be demoed end-to-end in &lt;5 minutes.
                </p>
              </div>
            </label>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Tier Name</label>
            <Input
              placeholder="e.g., Basic, Pro, Enterprise"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount</label>
            <Input
              type="number"
              placeholder="9.99"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Billing Cycle</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom (Seconds)</option>
            </select>
          </div>

          {billingCycle === "custom" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Interval (seconds)</label>
              <Input
                type="number"
                placeholder="30"
                value={customSeconds}
                onChange={(e) => setCustomSeconds(e.target.value)}
              />
            </div>
          )}


          {previewAmount && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Live Preview</p>
              <p className="text-lg font-semibold">{previewAmount.replace("SUI", "USD")}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!account || isPending} loading={isPending}>
            {isEditMode ? "Update Tier" : "Add Tier"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}