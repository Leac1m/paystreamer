import { useQuery } from "@tanstack/react-query";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { DEVNET_COIN_TYPE_REGISTRY_ID, DEMO_DENOMINATIONS } from "../../constants";

type Denomination = {
  type: string;
  name: string;
  symbol: string;
  isStable: boolean;
};

const SUI_TYPE_ARG = "0x2::sui::SUI";
const USDC_TYPE_ARG = "0x5d4b5a3d8c9f7b6e4a1c3d9e8f2a4b7c6d8e1f3a5b7c9d2e4f6a8b1c3d5e7f9::usdc::USDC";
const USDSUI_TYPE_ARG = "0x5d4b5a3d8c9f7b6e4a1c3d9e8f2a4b7c6d8e1f3a5b7c9d2e4f6a8b1c3d5e7f9::usdsui::USDSui";

interface DenominationSelectorProps {
  selected: string | null;
  onSelect: (type: string) => void;
}

export function DenominationSelector({ selected, onSelect }: DenominationSelectorProps) {
  const client = useCurrentClient();

  const { data: registry } = useQuery({
    queryKey: ["coin-type-registry", DEVNET_COIN_TYPE_REGISTRY_ID],
    queryFn: async () => {
      const { object } = await client.core.getObject({
        objectId: DEVNET_COIN_TYPE_REGISTRY_ID,
        include: { json: true },
      });
      return object;
    },
  });

  const allDenominations: Denomination[] = [
    {
      type: SUI_TYPE_ARG,
      name: "Sui",
      symbol: "SUI",
      isStable: false,
    },
  ];

  if (registry?.json) {
    const fields = registry.json as Record<string, unknown>;
    const coinToDiscriminant = fields.coin_to_discriminant as Record<string, number> | undefined;
    if (coinToDiscriminant) {
      if (Object.values(coinToDiscriminant).some((d) => d > 0)) {
        allDenominations.push({
          type: USDC_TYPE_ARG,
          name: "USD Coin",
          symbol: "USDC",
          isStable: true,
        });
        allDenominations.push({
          type: USDSUI_TYPE_ARG,
          name: "Sui USD",
          symbol: "USDSui",
          isStable: true,
        });
      }
    }
  }

  // Filter to the demo-enabled set. USDC and USDSui are excluded from
  // DEMO_DENOMINATIONS until their coin types are registered on chain
  // (see src/constants.ts for the full note).
  const availableDenominations = allDenominations.filter((d) =>
    DEMO_DENOMINATIONS.includes(d.type)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {availableDenominations.map((denom) => {
        const isSelected = selected === denom.type;
        return (
          <Card
            key={denom.type}
            className={cn(
              "cursor-pointer transition-all hover:border-primary/50",
              isSelected && "border-primary bg-primary/5"
            )}
            onClick={() => onSelect(denom.type)}
          >
            <CardContent className="flex flex-col items-center gap-3 py-6">
              <div className="text-3xl font-bold">{denom.symbol}</div>
              <div className="text-sm text-muted-foreground">{denom.name}</div>
              <Badge variant={denom.isStable ? "secondary" : "default"}>
                {denom.isStable ? "Stable" : "Volatile"}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
