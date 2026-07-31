# useSponsoredTransaction

The `useSponsoredTransaction` hook is a low-level utility that seamlessly wraps the Sui programmable transaction building process. It intelligently decides whether to route the transaction through your backend sponsor API or execute it locally using the user's SUI balance for gas.

## Usage

```tsx
import { useSponsoredTransaction } from "@paystreamer/sdk/react";
import { Transaction } from "@mysten/sui/transactions";

function CustomAction() {
  const { executeSponsored } = useSponsoredTransaction();

  const handleAction = async () => {
    const tx = new Transaction();
    // ... add moveCall or other commands ...

    const result = await executeSponsored(tx);
    
    if (result.status === "success") {
      console.log("Success! Digest:", result.digest);
    } else {
      console.error("Failed:", result.error);
    }
  };

  return <button onClick={handleAction}>Execute Action</button>;
}
```

## API

### Returns

An object containing:

| Property | Type | Description |
|----------|------|-------------|
| `executeSponsored` | `(tx: Transaction) => Promise<ExecuteSponsoredResult>` | Executes the provided transaction block, attempting sponsorship first if configured, or falling back to local execution. |

### `ExecuteSponsoredResult`

The returned result object contains:

| Property | Type | Description |
|----------|------|-------------|
| `digest` | `string` *(optional)* | Transaction digest upon successful execution. |
| `error` | `string` *(optional)* | Error message if transaction execution failed. |
| `executionMode` | `"sponsored" \| "local_balance" \| "local_fallback"` *(optional)* | Indicates how gas payment was settled for this transaction block. |
| `isSponsored` | `boolean` *(optional)* | `true` if gas was paid by the sponsor backend (`"sponsored"` mode); `false` if paid via wallet gas coin (`"local_balance"` or `"local_fallback"`). |

### Gas Sponsoring & Fallback Behavior

When calling `executeSponsored`, the hook evaluates gas resolution with the following priority:
1. **Local Balance Threshold (`local_balance`)**: If the user's wallet has a SUI balance &ge; **0.01 SUI** (`10,000,000` MIST), the transaction runs directly via wallet signing to minimize network latency and preserve sponsor gas pool resources.
2. **Sponsored Execution (`sponsored`)**: If the balance is < 0.01 SUI, the hook forwards the unsigned transaction to the sponsor backend endpoint. The service signs as the `gasOwner` and pays gas fees.
3. **Graceful Fallback (`local_fallback`)**: If the sponsor endpoint fails, times out, or returns an error, but the user still holds enough leftover SUI in their wallet, the hook automatically attempts local execution instead of aborting the user action.
