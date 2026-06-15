import { useState, useEffect } from "react";
import { useCurrentNetwork } from "@mysten/dapp-kit-react";
import { X, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";

const NETWORK_STORAGE_KEY = "paystreamer_network_banner_dismissed";
const DEVNET_FAUCET_URL = "https://faucet.sui.io/?network=devnet";

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
      text: "Devnet — No real money",
      textColor: "text-amber-200",
      showFaucet: true,
    },
    testnet: {
      bg: "bg-blue-500/20 border-blue-500/50",
      text: "Testnet",
      textColor: "text-blue-200",
      showFaucet: true,
    },
    mainnet: {
      bg: "bg-green-500/20 border-green-500/50",
      text: "Mainnet",
      textColor: "text-green-200",
      showFaucet: false,
    },
  };

  const { bg, text, textColor, showFaucet } =
    config[network as keyof typeof config] ?? config.devnet;

  return (
    <div
      className={cn(
        "w-full py-2 px-4 flex items-center justify-between gap-3 border-b",
        bg
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn("text-sm font-medium", textColor)}>{text}</span>
        {showFaucet && (
          <a
            href={DEVNET_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
              "bg-amber-500 hover:bg-amber-400 text-black transition-colors"
            )}
            style={{ backgroundColor: "#f59e0b" }}
          >
            Get test SUI
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      <button
        onClick={dismiss}
        className={cn("p-1 rounded hover:bg-white/10 shrink-0", textColor)}
        aria-label="Dismiss banner"
      >
        <X size={16} />
      </button>
    </div>
  );
}