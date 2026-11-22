import { planGift, validateArkCatalog } from './icepack-config-engine.mjs';
import { validateGiftRequest } from './preview-safety.mjs';
import { convertDashboard } from './sync.mjs';

// Expand the draft with the same rules as Companion sync. This path only returns a plan.
export function previewDashboardDraft(input, bundledCatalog) {
  const gift = validateGiftRequest(input?.gift);
  const hasCatalog = input?.catalog !== undefined;
  if (hasCatalog && input.catalog?.schemaVersion !== 2) {
    throw new Error('Choose a version 2 ARK catalog exported by Kit Editor.');
  }
  const catalog = validateArkCatalog(hasCatalog ? input.catalog : bundledCatalog);
  const { config } = convertDashboard(input?.draft, catalog);
  const plan = planGift(config, catalog, gift);
  return { ...plan, gift: gift.name, catalogSource: hasCatalog ? 'provided' : 'bundled' };
}
