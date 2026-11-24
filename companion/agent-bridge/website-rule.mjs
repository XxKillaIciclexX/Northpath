import { convertDashboard } from './sync.mjs';
import { validateConfiguration } from './icepack-config-engine.mjs';

function giftText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function selectWebsiteRule(draft, gift, current, catalog) {
  const key = giftText(gift);
  if (!key || key.length > 120) throw Error('Enter a gift name or ID from the website draft.');
  if (draft?.version !== 1 || !Array.isArray(draft.rules) || draft.rules.length > 500) {
    throw Error('Expected a saved Northpath draft with Gift Rules.');
  }
  const matches = draft.rules.filter(rule => giftText(rule?.giftName) === key || giftText(rule?.giftId) === key);
  if (matches.length !== 1) throw Error('Choose a gift name or ID that identifies exactly one rule in the saved draft.');
  const [selected] = matches;
  if (selected.enabled !== true) throw Error('Enable this Gift Rule on the website and save the draft again.');
  if (selected.action?.type === 'kit') throw Error('Choose a rule with a direct item or dinosaur reward for this test.');
  const [replacement] = convertDashboard({ version: 1, rules: [selected], kits: [] }, catalog, { multipleDinosaurs: true }).config.rules;

  const matchesLocal = current.rules.filter(rule =>
    (replacement.giftName && giftText(rule.giftName) === giftText(replacement.giftName)) ||
    (replacement.giftId && giftText(rule.giftId) === giftText(replacement.giftId)));
  if (matchesLocal.length > 1) throw Error('This gift matches more than one local rule. Resolve the overlapping gift IDs or names first.');
  const [previous] = matchesLocal;
  const rule = previous ? {
    ...replacement, id: previous.id, cooldown: previous.cooldown,
    giftName: replacement.giftName ?? previous.giftName, giftId: replacement.giftId ?? previous.giftId,
  } : replacement;
  const rules = previous ? current.rules.map(existing => existing === previous ? rule : existing) : [...current.rules, rule];
  const config = validateConfiguration({ ...current, rules }, catalog);
  return { config, rule, previous };
}

export function assertRewardLanesIdle(state) {
  const custom = state?.customRules;
  const experimental = state?.giftRcon;
  if (!['off', 'preview'].includes(custom?.mode) || custom.queued !== 0 || custom.inflight !== false ||
      experimental?.mode !== 'off' || experimental.queued !== 0 || experimental.inflight !== false ||
      state.armed !== false || state.autoEnabled !== false || state.pending !== 0 || state.rewardPending !== 0 || state.active !== null) {
    throw Error('Turn off live gift lanes, disarm legacy rewards, and wait for active deliveries to finish.');
  }
}
