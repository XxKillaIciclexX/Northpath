export type HostedReward = {
  id: string;
  label: string;
  category: string;
  item?: { catalogId: string; name: string; category: string; blueprint: string };
};
export const defaultItemQuantity: number;
export const maxItemQuantity: number;
export const rewardCatalog: HostedReward[];
export const rewardsById: Map<string, HostedReward>;
