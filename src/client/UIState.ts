import { PlayerBuildableUnitType } from "@openfront/engine-api/game/GameTypes";

export interface UIState {
  preventStacking?: boolean;
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  // games with mass orders: the panel is shown, the ghost stays after each
  // placement and holding the button repeats it
  massOrders?: boolean;
  holdRepeat?: boolean;
}
