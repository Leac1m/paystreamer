# TierCard

The `TierCard` component provides a clean UI for displaying a specific subscription tier offered by your platform. It handles its own state for "Deactivating" the tier (if you are the platform admin). 

*Note: For consumers, you may want to build a "Subscribe" card instead, or wrap this component with a subscribe button.*

## Usage

```tsx
import { TierCard } from "@paystreamer/sdk/ui";

const myTier = {
  name: "Pro Tier",
  amount: "50000000000",
  frequency: "monthly",
  subscriber_count: 42,
  is_active: true
};

<TierCard
  platformId="0x123..."
  initialSharedVersion={100}
  tier={myTier}
  tierIndex={1}
  onDeactivated={() => refetchTiers()}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `platformId` | `string` | The object ID of your deployed platform. |
| `initialSharedVersion` | `number` | The initial shared version of the platform object. Required for proper PTB execution. |
| `tier` | `TierInfo` | The object containing the tier details (name, amount, frequency, count, status). |
| `tierIndex` | `number` | The index of this tier within the platform's tier table. |
| `onDeactivated?` | `() => void` | Callback fired when the platform owner successfully deactivates the tier. |
| `formatAmount?` | `(mist: string) => string` | Custom formatter to display the pricing amount. |
| `formatFrequency?` | `(tier: TierInfo) => string` | Custom formatter to display the billing frequency. |

## Styling Requirements

This component leverages standard class names compatible with **TailwindCSS**.
