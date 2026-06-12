import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, CheckCircle } from "lucide-react";
import { useCurrentClient, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { Button } from "../ui/button";
import { TxStatusToast, TxStatus } from "../TxStatusToast";
import { parseMoveError } from "../../lib/errors";
import { useNavigate } from "react-router-dom";
import {
  DEVNET_V2_PACKAGE_ID,
  DEVNET_COIN_TYPE_REGISTRY_ID,
  CLOCK_OBJECT_ID,
  SUI_TYPE_ARG,
} from "../../constants";

interface SetupSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  platformId: string;
  tierIndex: number;
  tierAmount: bigint;
  tierFrequencyMs: bigint;
  accountId?: string;
  accountCapId?: string;
  currentBalance?: bigint;
  onSuccess: (txDigest: string) => void;
}

export function SetupSubscriptionModal({
  isOpen,
  onClose,
  platformId,
  tierIndex,
  tierAmount,
  tierFrequencyMs,
  accountId,
  accountCapId,
  currentBalance = 0n,
  onSuccess,
}: SetupSubscriptionModalProps) {
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const navigate = useNavigate();
  
  const hasAccount = !!accountId && !!accountCapId;
  const recommendedBuffer = tierAmount * 3n;
  const shortfall = currentBalance < recommendedBuffer ? recommendedBuffer - currentBalance : 0n;
  const absoluteMinRequired = currentBalance < tierAmount ? tierAmount - currentBalance : 0n;
  
  const minDepositSui = Number(absoluteMinRequired) / 1_000_000_000;
  const defaultDepositSui = Number(shortfall) / 1_000_000_000;
  const currentBalanceSui = Number(currentBalance) / 1_000_000_000;
  const tierAmountSui = Number(tierAmount) / 1_000_000_000;

  const [depositAmount, setDepositAmount] = useState(defaultDepositSui.toString());
  const [step, setStep] = useState<"input" | "success">("input");
  
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("");
  const [txDigest, setTxDigest] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setDepositAmount(defaultDepositSui.toString());
      setTxStatus("idle");
      setTxDigest(undefined);
    }
  }, [isOpen, platformId, tierIndex]); // reset when modal opens for a new tier

  if (!isOpen) return null;

  const handleSubscribe = async () => {
    const amountVal = parseFloat(depositAmount || "0");
    if (amountVal < minDepositSui) {
      setTxStatus("error");
      setTxMessage(`Deposit must be at least ${minDepositSui} SUI to cover the first bill.`);
      return;
    }

    setTxStatus("pending");
    setTxMessage(hasAccount ? "Funding and subscribing..." : "Setting up account and subscribing...");

    try {
      const tx = new Transaction();
      tx.setGasBudget(100_000_000);

      let workingAccountObj: any = tx.object(accountId || "0x0");
      let workingCap: any = tx.object(accountCapId || "0x0");

      if (!hasAccount) {
        // 1. Create account
        const initialPolicies = tx.moveCall({
          target: `${DEVNET_V2_PACKAGE_ID}::account::empty_policy_set`,
        });

        const [newAccountObj, newCap] = tx.moveCall({
          target: `${DEVNET_V2_PACKAGE_ID}::account::create_account`,
          typeArguments: [SUI_TYPE_ARG],
          arguments: [
            tx.object(DEVNET_COIN_TYPE_REGISTRY_ID),
            initialPolicies,
            tx.object(CLOCK_OBJECT_ID),
          ],
        });
        workingAccountObj = newAccountObj;
        workingCap = newCap;
      }

      // 2. Deposit SUI (if amount > 0)
      const amountInMist = Math.floor(amountVal * 1_000_000_000);
      if (amountInMist > 0) {
        const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
        tx.moveCall({
          target: `${DEVNET_V2_PACKAGE_ID}::account::deposit`,
          typeArguments: [SUI_TYPE_ARG],
          arguments: [
            workingCap,
            workingAccountObj,
            coin,
            tx.object(CLOCK_OBJECT_ID),
          ],
        });
      }

      // 3. Create Subscription
      const accountType = tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::registry::from_u8`,
        arguments: [tx.pure.u8(0)],
      });

      tx.moveCall({
        target: `${DEVNET_V2_PACKAGE_ID}::billing::create_subscription`,
        typeArguments: [SUI_TYPE_ARG],
        arguments: [
          workingCap,
          workingAccountObj,
          tx.pure.id(platformId),
          tx.pure.u64(BigInt(tierIndex)),
          tx.pure.u64(tierAmount),
          tx.pure.u64(tierFrequencyMs),
          accountType,
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      // 4. Share account (only if we created a NEW one)
      if (!hasAccount) {
        tx.moveCall({
          target: `${DEVNET_V2_PACKAGE_ID}::account::share_account`,
          typeArguments: [SUI_TYPE_ARG],
          arguments: [workingAccountObj, workingCap],
        });
      }

      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.$kind === "FailedTransaction") {
        throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
      }

      await client.core.waitForTransaction({ digest: result.Transaction.digest });
      
      setTxDigest(result.Transaction.digest);
      setTxStatus("success");
      setTxMessage("Subscription active!");
      
      onSuccess(result.Transaction.digest);
      setStep("success");
    } catch (err) {
      console.error("Subscription Error:", err);
      setTxStatus("error");
      setTxMessage(parseMoveError(err));
    }
  };

  const isPending = txStatus === "pending";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isPending ? onClose : undefined}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-card border shadow-xl rounded-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold">
              {step === "success" ? "Success!" : (hasAccount ? "Fill Up & Subscribe" : "Setup Subscription")}
            </h2>
            <button
              onClick={onClose}
              disabled={isPending}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {step === "input" ? (
              <>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Tier Amount</span>
                    <span className="font-semibold">{tierAmountSui} SUI</span>
                  </div>
                  {hasAccount && (
                    <div className="flex justify-between items-center text-sm border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-semibold text-primary">{currentBalanceSui} SUI</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {hasAccount ? "Additional Deposit (SUI)" : "Initial Deposit (SUI)"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Wallet size={16} className="text-muted-foreground" />
                    </div>
                    <input
                      type="number"
                      min={minDepositSui}
                      step="0.1"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      disabled={isPending}
                      className="w-full pl-10 pr-4 py-2 bg-background border rounded-lg focus:ring-2 focus:ring-primary/50 transition-shadow disabled:opacity-50"
                      placeholder="Enter amount..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {minDepositSui > 0 
                      ? `Minimum required: ${minDepositSui} SUI to cover the first cycle.`
                      : "Your existing balance covers the first cycle."}
                    {" "}We recommend a buffer of at least 3 months to avoid interruptions.
                  </p>
                </div>

                <Button
                  onClick={handleSubscribe}
                  disabled={isPending}
                  loading={isPending}
                  variant="gradient"
                  className="w-full py-6 text-lg"
                >
                  {hasAccount 
                    ? (parseFloat(depositAmount || "0") > 0 ? "Fill Up & Subscribe" : "Subscribe Now") 
                    : "Complete Setup & Subscribe"}
                </Button>
              </>
            ) : (
              <div className="text-center space-y-6 py-4">
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <CheckCircle className="w-20 h-20 text-green-500" />
                  </motion.div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">You're Subscribed!</h3>
                  <p className="text-muted-foreground">
                    Your subscription is active and automated billing has been configured.
                  </p>
                </div>
                
                <div className="flex flex-col gap-3 pt-4">
                  <Button
                    onClick={() => {
                      onClose();
                      navigate("/dashboard");
                    }}
                    variant="gradient"
                    className="w-full py-6"
                  >
                    Manage Subscriptions
                  </Button>
                  <Button
                    onClick={() => {
                      onClose();
                      navigate("/");
                    }}
                    variant="outline"
                    className="w-full py-6"
                  >
                    Browse More Platforms
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <TxStatusToast
          status={txStatus}
          message={txMessage}
          digest={txDigest}
          onClose={() => setTxStatus("idle")}
        />
      </div>
    </AnimatePresence>
  );
}
