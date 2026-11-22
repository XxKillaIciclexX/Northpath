import { planGift, validateArkCatalog, validateConfiguration } from './icepack-config-engine.mjs';
import { validateGiftRequest } from './preview-safety.mjs';
import { convertDashboard } from './sync.mjs';

function selectCatalog(input, bundledCatalog) {
  const hasCatalog = input?.catalog !== undefined;
  if (hasCatalog && input.catalog?.schemaVersion !== 2) {
    throw new Error('Choose a version 2 ARK catalog exported by Kit Editor.');
  }
  return {
    catalog: validateArkCatalog(hasCatalog ? input.catalog : bundledCatalog),
    catalogSource: hasCatalog ? 'provided' : 'bundled',
  };
}

function convertDraft(input, bundledCatalog) {
  const { catalog, catalogSource } = selectCatalog(input, bundledCatalog);
  const { config, warnings } = convertDashboard(input?.draft, catalog, { multipleDinosaurs: true });
  return { config, warnings, catalog, catalogSource };
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

function validateForComparison(config, catalog, label) {
  try {
    return validateConfiguration(config, catalog);
  } catch (error) {
    throw new Error(`${label}: ${error.message}`, { cause: error });
  }
}

function summarizeChanges(before, after, label, fields) {
  const previousById = new Map(before.map(entry => [entry.id, entry]));
  const changes = [];
  let unchanged = 0;
  for (const entry of after) {
    const previous = previousById.get(entry.id);
    previousById.delete(entry.id);
    if (!previous) {
      changes.push({ id: entry.id, label: label(entry), status: 'added' });
      continue;
    }
    const changedFields = Object.keys(fields)
      .filter(key => JSON.stringify(previous[key]) !== JSON.stringify(entry[key]))
      .map(key => fields[key]);
    if (changedFields.length) {
      changes.push({ id: entry.id, label: label(entry), status: 'changed', fields: changedFields });
    } else {
      unchanged++;
    }
  }
  for (const entry of previousById.values()) {
    changes.push({ id: entry.id, label: label(entry), status: 'removed' });
  }
  return { changes, unchanged };
}

export function compareEngineDraft(input, bundledCatalog) {
  const { catalog, catalogSource } = selectCatalog(input, bundledCatalog);
  const current = validateForComparison(input?.current, catalog, 'Current Kit Editor file');
  const candidate = validateForComparison(input?.config, catalog, 'Reviewed draft');
  return {
    catalogSource,
    rules: summarizeChanges(current.rules, candidate.rules, rule => rule.giftName ?? rule.giftId, {
      giftName: 'gift name', giftId: 'gift ID', enabled: 'enabled state', cooldown: 'cooldown', reward: 'reward',
    }),
    kits: summarizeChanges(current.kits, candidate.kits, kit => kit.name, {
      name: 'name', entries: 'entries or entry order',
    }),
  };
}
