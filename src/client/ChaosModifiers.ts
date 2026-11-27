// our chaos modifiers, offered as toggles in the host and solo screens
export const CHAOS_TOGGLES = [
  { key: "isVolcano", labelKey: "public_game_modifier.volcano_label" },
  { key: "isContracts", labelKey: "public_game_modifier.contracts_label" },
  { key: "isBlackMarket", labelKey: "public_game_modifier.black_market_label" },
  { key: "isTreasures", labelKey: "public_game_modifier.treasures_label" },
  { key: "isFog", labelKey: "public_game_modifier.fog_label" },
  { key: "isTurboSilos", labelKey: "public_game_modifier.turbo_silos_label" },
  { key: "isMassOrders", labelKey: "public_game_modifier.mass_orders_label" },
] as const;

export type ChaosKey = (typeof CHAOS_TOGGLES)[number]["key"];

export function chaosFlags(keys: readonly string[]): Record<ChaosKey, boolean> {
  return {
    isVolcano: keys.includes("isVolcano"),
    isContracts: keys.includes("isContracts"),
    isBlackMarket: keys.includes("isBlackMarket"),
    isTreasures: keys.includes("isTreasures"),
    isFog: keys.includes("isFog"),
    isTurboSilos: keys.includes("isTurboSilos"),
    isMassOrders: keys.includes("isMassOrders"),
  };
}
