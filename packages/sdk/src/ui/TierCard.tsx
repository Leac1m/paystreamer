// @ts-nocheck
import React, { useState } from "react";
import { PowerOff, Power } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useManageTier } from "../react/useManageTier";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./components/card";
import { Button } from "./components/button";
import { Badge } from "./components/badge";

interface TierInfo {
  name: string;
  amount: string;
  frequency: string | number;
  subscriber_count: number;
  is_active: boolean;
}

export interface TierCardProps {
  platformId: string;
  initialSharedVersion: number;
  tier: TierInfo;
  tierIndex: number;
  // Optional callback to refresh the UI after deactivation
  onDeactivated?: () => void;
  // Utility functions injected by the host app (or default implementation)
  formatAmount?: (mist: string) => string;
  formatFrequency?: (tier: TierInfo) => string;
}

export function TierCard({
  platformId,
  initialSharedVersion,
  tier,
  tierIndex,
  onDeactivated,
  formatAmount = (amount) => `${Number(amount) / 1e9} PUSD`,
  formatFrequency = () => "Monthly",
}: TierCardProps) {
  const account = useCurrentAccount();
  const { deactivateTier, isLoading, error } = useManageTier({
    platformId,
    initialSharedVersion,
  });

  async function handleDeactivate() {
    if (!account) return;
    try {
      await deactivateTier(tierIndex);
      if (onDeactivated) onDeactivated();
    } catch (err) {
      console.error("Failed to deactivate tier:", err);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{tier.name}</CardTitle>
            <CardDescription>{formatFrequency(tier)}</CardDescription>
          </div>
          {tier.is_active ? (
            <Badge variant="default" className="bg-green-600">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{formatAmount(tier.amount)}</p>
            <p className="text-sm text-muted-foreground">
              {tier.subscriber_count} subscriber{tier.subscriber_count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {tier.is_active ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeactivate}
              disabled={!account || isLoading}
            >
              <PowerOff className="h-4 w-4 mr-1" />
              {isLoading ? "Deactivating..." : "Deactivate"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
            >
              <Power className="h-4 w-4 mr-1" />
              Activate
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
