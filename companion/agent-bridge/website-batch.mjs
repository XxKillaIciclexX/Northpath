import { convertDashboard, hashConfig } from './sync.mjs';
import { validateConfiguration } from './icepack-config-engine.mjs';

export const emptyOwnership = { rules: [], kits: [] };
const giftKey = value => value?.trim().toLowerCase();
const giftMatches = (a, b) => (a.giftId && giftKey(a.giftId) === giftKey(b.giftId)) ||
  (a.giftName && giftKey(a.giftName) === giftKey(b.giftName));

function mergeEntries(current, incoming, previous, matches, update, retain = () => false) {
  const known = new Map(previous.map(entry => [entry.sourceId, entry]));
  const used = new Set();
  const replacements = new Map();
  const additions = [];
  const owners = [];
  for (const source of incoming) {
    const owner = known.get(source.id);
    const matched = current.filter(entry => entry.id === owner?.localId || matches(source, entry));
    if (matched.length > 1 || (matched[0] && used.has(matched[0].id))) {
      throw Error(`The website entry ${source.giftName ?? source.name ?? source.id} matches overlapping local entries.`);
    }
    const [old] = matched;
    if (owner && old?.id !== owner.localId) throw Error(`The local entry ${owner.localId} changed since account sync.`);
    if (old && previous.some(entry => entry.localId === old.id && entry.sourceId !== source.id)) {
      throw Error(`The local entry ${old.id} is already linked to another website entry.`);
    }
    const next = old ? update(source, old) : source;
    const hash = hashConfig(next);
    if (owner && hashConfig(old) !== owner.hash && hashConfig(old) !== hash) {
      throw Error(`The local entry ${owner.localId} changed since account sync.`);
    }
    if (old) { used.add(old.id); replacements.set(old.id, next); }
    else additions.push(next);
    known.delete(source.id);
    owners.push({ sourceId: source.id, localId: next.id, hash });
  }
  const removed = new Map([...known.values()].map(entry => [entry.localId, entry.hash]));
  const retained = current.flatMap(entry => {
    if (replacements.has(entry.id)) return [replacements.get(entry.id)];
    if (!removed.has(entry.id) || retain(entry)) return [entry];
    if (removed.get(entry.id) !== hashConfig(entry)) throw Error(`The local entry ${entry.id} changed since account sync.`);
    return [];
  });
  return { entries: [...retained, ...additions], owners };
}

export function mergeWebsiteDraft(draft, saved, previous = emptyOwnership) {
  const incoming = convertDashboard(draft, saved.catalog, { multipleDinosaurs: true }).config;
  const rules = mergeEntries(saved.config.rules, incoming.rules, previous.rules, giftMatches, (rule, old) => ({
    ...rule, id: old.id, cooldown: old.cooldown, giftName: rule.giftName ?? old.giftName, giftId: rule.giftId ?? old.giftId,
  }));
  const kitIds = new Set(rules.entries.flatMap(rule => rule.reward.type === 'kit' ? [rule.reward.kitId] : []));
  const kits = mergeEntries(saved.config.kits, incoming.kits, previous.kits, (a, b) => a.id === b.id,
    kit => kit, kit => kitIds.has(kit.id));
  const config = validateConfiguration({ schemaVersion: 2, rules: rules.entries, kits: kits.entries }, saved.catalog);
  return { config, owned: { rules: rules.owners, kits: kits.owners } };
}

export function rehearseChanges(planner, saved, config) {
  const previousRules = new Map(saved.config.rules.map(rule => [rule.id, hashConfig(rule)]));
  const previousKits = new Map(saved.config.kits.map(kit => [kit.id, hashConfig(kit)]));
  const kits = new Map(config.kits.map(kit => [kit.id, kit]));
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    const kit = rule.reward.type === 'kit' ? kits.get(rule.reward.kitId) : null;
    if (previousRules.get(rule.id) === hashConfig(rule) && (!kit || previousKits.get(kit.id) === hashConfig(kit))) continue;
    try { planner.buildPlanCommands({ actions: kit?.entries ?? [rule.reward] }, saved.catalog, saved.enabledPacks, '1'); }
    catch (error) { throw Error(`${rule.giftName ?? rule.giftId}: ${error.message}`); }
  }
}
