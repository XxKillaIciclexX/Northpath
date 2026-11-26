import fixedRewards from './reward-catalog.json' with { type: 'json' };
import items from './hosted-items.json' with { type: 'json' };

export const defaultItemQuantity = 5;
export const maxItemQuantity = 100;
export const defaultDinosaurLevel = 25;
export const maxDinosaurLevel = 150;
const legacyItemIds = new Map([['Stone', 'rose-stone'], ['Wood', 'wood-5'], ['Thatch', 'thatch-5']]);
const byCatalogId = new Map(items.map(entry => [entry.id, entry]));

function asReward(item) {
  return { id: legacyItemIds.get(item.id) ?? 'item:' + item.id, label: item.name, category: 'Items',
    item: { catalogId: item.id, name: item.name, category: item.category, blueprint: item.blueprint.replace(/_C$/, '') } };
}

export const rewardCatalog = [
  ...fixedRewards.map(reward => {
    for (const [catalogId, id] of legacyItemIds) {
      if (reward.id === id) return { ...asReward(byCatalogId.get(catalogId)), label: reward.label };
    }
    return reward;
  }),
  ...items.filter(item => !legacyItemIds.has(item.id))
    .sort((first, second) => {
      if (first.id < second.id) return -1;
      if (first.id > second.id) return 1;
      return 0;
    })
    .map(asReward),
];

export const rewardsById = new Map(rewardCatalog.map(reward => [reward.id, reward]));
