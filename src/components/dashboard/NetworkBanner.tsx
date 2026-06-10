import { AlertTriangle } from "lucide-react";

export function NetworkBanner() {
  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="container mx-auto flex items-center gap-2 text-sm text-yellow-600">
        <AlertTriangle className="h-4 w-4" />
        <span>
          You are connected to <strong>Devnet</strong>. Transactions are simulated and use test tokens.
        </span>
      </div>
    </div>
  );
}
