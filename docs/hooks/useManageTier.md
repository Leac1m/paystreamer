# useManageTier

The `useManageTier` hook allows Platform Owners to easily manage the lifecycle of their subscription tiers. Currently, it supports deactivating an active tier.

*Note: You must be the owner of the platform capability to execute these transactions.*

## Usage

```tsx
import { useManageTier } from "@paystreamer/sdk/react";

function TierAdminControls({ tierIndex }) {
  const { deactivateTier, isLoading, error } = useManageTier({
    platformId: "0xYOUR_PLATFORM",
    initialSharedVersion: 123, // Requires the initial shared version
  });

  const handleDeactivate = async () => {
    const txDigest = await deactivateTier(tierIndex);
    if (txDigest) {
      console.log("Tier deactivated successfully!", txDigest);
    }
  };

  return (
    <div>
      <button onClick={handleDeactivate} disabled={isLoading}>
        {isLoading ? "Deactivating..." : "Deactivate Tier"}
      </button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

## Parameters

You must pass an object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `platformId` | `string` | The target platform object ID. |
| `initialSharedVersion` | `number \| string` | The `initial_shared_version` of the platform object, required by the Sui network when using shared objects in PTBs. |

## Returns

An object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `deactivateTier` | `(tierIndex: number \| bigint) => Promise<string \| null>` | Disables the tier so no new subscriptions can be created for it. Returns the transaction digest. |
| `isLoading` | `boolean` | True while the transaction is being built, signed, or executed. |
| `error` | `Error \| null` | Standard JavaScript Error object if the transaction fails. |
