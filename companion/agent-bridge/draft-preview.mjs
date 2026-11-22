import { planGift, validateArkCatalog } from './icepack-config-engine.mjs';
import { validateGiftRequest } from './preview-safety.mjs';
import { convertDashboard } from './sync.mjs';

function convertDraft(input, bundledCatalog) {
  const hasCatalog = input?.catalog !== undefined;
  if (hasCatalog && input.catalog?.schemaVersion !== 2) {
    throw new Error('Choose a version 2 ARK catalog exported by Kit Editor.');
  }
  const catalog = validateArkCatalog(hasCatalog ? input.catalog : bundledCatalog);
  const { config, warnings } = convertDashboard(input?.draft, catalog, { multipleDinosaurs: true });
  return { config, warnings, catalog, catalogSource: hasCatalog ? 'provided' : 'bundled' };
}

// Expand the draft with the same rules as Companion sync. This path only returns a plan.
export function previewDashboardDraft(input, bundledCatalog) {
  const gift = validateGiftRequest(input?.gift);
  const { config, catalog, catalogSource } = convertDraft(input, bundledCatalog);
  const plan = planGift(config, catalog, gift);
  return { ...plan, gift: gift.name, catalogSource };
}

export function exportDashboardDraft(input, bundledCatalog) {
  const { config, warnings, catalogSource } = convertDraft(input, bundledCatalog);
  return { config, warnings, catalogSource };
}
