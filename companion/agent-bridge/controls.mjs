// Browser controls can switch Custom Gift Rules to Off or Preview.
export function validateControl(action, state) {
  if (!['start-preview', 'stop-preview', 'emergency-stop'].includes(action)) throw Error('Unknown local control');
  if (!state?.engineOnline) throw Error('Local engine is not reachable');
  if (action === 'start-preview') {
    if (!state.customRulesLoaded) throw Error('Load custom rules in the original engine first');
    if (state.customRulesMode === 'live' || state.armState || state.giftRconMode !== 'off') throw Error('Stop live modes and disarm other reward lanes before starting preview');
    if (state.customInflight || state.customQueued > 0 || state.pending > 0) throw Error('Wait until pending work is cleared');
  }
  if (action === 'stop-preview' && state.customRulesMode === 'live') throw Error('Use Emergency Stop to stop LIVE custom rules');
  return action;
}
export function activityCategory(message) {
  if (/\b(error|failed|blocked|rejected|invalid)\b/i.test(message)) return 'errors';
  if (/\bRCON\b/i.test(message)) return 'rcon';
  if (/\bpreview\b/i.test(message)) return 'previews';
  if (/\b(gift|rules|kit)\b/i.test(message)) return 'gifts';
  return 'other';
}
