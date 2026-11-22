// Engine-backed player targeting. Never enable Live or issue RCON.
export function validateTargetId(value) {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value) || BigInt(value) < 1n || BigInt(value) > 4294967295n) {
    throw Error('Enter a valid numeric Specimen Implant ID (1–4294967295).');
  }
  return value;
}
export function getEngineTarget(raw) {
  const playerId = raw?.settings?.playerId;
  const savedId = typeof playerId === 'string' && /^\d{1,10}$/.test(playerId) && Number(playerId) > 0 && Number(playerId) <= 4294967295 ? playerId : null;
  return {playerId:savedId,configured:Boolean(savedId),laneConfigured:raw?.customRules?.playerIdConfigured===true,mode:String(raw?.customRules?.mode??'unknown')};
}
export function assertTargetSaveSafe(state) {
  if(!state?.engineOnline || state.armState || state.giftRconMode !== 'off' || state.customRulesMode !== 'off' || state.pending !== 0 || state.customQueued !== 0 || state.customInflight) {
    throw Error('Stop Custom Rules, legacy rewards, and experimental rewards; clear queues before saving the player target.');
  }
}
