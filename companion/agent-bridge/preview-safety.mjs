// Narrow validation for local-only engine preview. No generic forwarding or RCON calls.
export function validateGiftRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid gift preview');
  const { id, name } = input;
  if (typeof id !== 'string' || id.length > 100 || /[\u0000-\u001f]/.test(id)) throw Error('Invalid gift ID');
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\u0000-\u001f]/.test(name)) throw Error('Invalid gift name');
  return { id: id.trim(), name: name.trim() };
}
export function assertPreviewOnly(status) {
  if (!status || !status.engineOnline) throw Error('Engine offline');
  if (status.customRulesMode !== 'preview') throw Error('Enable CUSTOM preview mode in the original engine first');
  if (!status.customRulesLoaded) throw Error('Load custom rules in the original engine first');
  if (status.armState || status.giftRconMode !== 'off') throw Error('Disarm legacy rewards and turn off the experimental RCON lane');
  if (status.customInflight || status.customQueued > 0 || status.pending > 0) throw Error('Wait until pending or in-flight work is cleared');
}
