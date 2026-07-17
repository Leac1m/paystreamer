# SetupSubscriptionModal

The `SetupSubscriptionModal` is a fully-featured UI component that guides a user through:
1. Creating a PayStreamer account (if they don't have one).
2. Depositing an initial PUSD buffer to cover future billing cycles.
3. Subscribing to your platform's specific tier.

## Usage

```tsx
import { SetupSubscriptionModal } from "@paystreamer/sdk/ui";

<SetupSubscriptionModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  platformId="0x123..."
  tierIndex={0}
  tierAmount={10000000000n} // 10 PUSD in MIST
  tierFrequencyMs={2592000000n} // 30 days
  onSuccess={(digest) => alert("Success! Tx: " + digest)}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is currently visible. |
| `onClose` | `() => void` | Callback fired when the user dismisses the modal. |
| `platformId` | `string` | The object ID of your deployed platform. |
| `tierIndex` | `number` | The array index of the tier the user is subscribing to. |
| `tierAmount` | `bigint` | The cost per cycle in MIST (1 PUSD = 10^9 MIST). |
| `tierFrequencyMs` | `bigint` | The length of the billing cycle in milliseconds. |
| `accountId?` | `string` | Optional. If known, pass the user's existing Account ID. |
| `accountCapId?` | `string` | Optional. If known, pass the user's existing AccountCap ID. |
| `currentBalance?` | `bigint` | Optional. The user's current subscription account balance. |
| `walletBalanceUsd?` | `number` | Optional. The amount of PUSD in the user's connected wallet. |
| `onSuccess?` | `(txDigest: string) => void` | Callback fired after a successful transaction. |
| `formatUsd?` | `(mist: bigint) => number` | Optional custom formatter for displaying USD/PUSD values. |

## Styling Requirements

This component leverages standard class names compatible with **TailwindCSS**. If you are importing this component, ensure your application either compiles Tailwind utilities or includes standard shadcn-ui styles.
