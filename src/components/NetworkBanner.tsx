import { useState, useEffect } from "react";
import { useCurrentNetwork } from "@mysten/dapp-kit-react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

const NETWORK_STORAGE_KEY = "paystreamer_network_banner_dismissed";

export default function NetworkBanner() {
  const network = useCurrentNetwork();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === network) {
      setDismissed(true);
    }
  }, [network]);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    sessionStorage.setItem(NETWORK_STORAGE_KEY, network);
    setDismissed(true);
  };

  const config = {
    devnet: {
      bg: "bg-amber-500/20 border-amber-500/50",
      text: "⚠️ Testnet — No real money",
      textColor: "text-amber-200",
    },
    testnet: {
      bg: "bg-blue-500/20 border-blue-500/50",
      text: "🧪 Testnet",
      textColor: "text-blue-200",
    },
    mainnet: {
      bg: "bg-green-500/20 border-green-500/50",
      text: "✅ Mainnet",
      textColor: "text-green-200",
    },
  };

  const { bg, text, textColor } = config[network as keyof typeof config] ?? config.devnet;

  return (
    <div
      className={cn(
        "w-full py-2 px-4 flex items-center justify-between border-b",
        bg
      )}
    >
      <span className={cn("text-sm font-medium", textColor)}>{text}</span>
      <button
        onClick={dismiss}
        className={cn("p-1 rounded hover:bg-white/10", textColor)}
        aria-label="Dismiss banner"
      >
        <X size={16} />
      </button>
    </div>
  );
}