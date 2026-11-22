// v1.7: Pure, read-only drift classification. No mutation, RCON, or Live controls.
export function assessDrift({draftHash,appliedHash,appliedRuleCount,appliedKitCount,engine}) {
  const draftMatchesApplied=appliedHash===null?null:draftHash===appliedHash;
  let engineAgreement='unknown';
  let reason='Engine is unavailable; its loaded configuration cannot be verified.';
  if (engine?.engineOnline) {
    if (!engine.customRulesLoaded) {
      engineAgreement='not-loaded';
      reason='Engine reports that custom rules are not loaded.';
    } else if (appliedHash===null) {
      reason='No applied configuration file exists to compare with engine counts.';
    } else if (engine.customRuleCount!==appliedRuleCount || engine.customKitCount!==appliedKitCount) {
      engineAgreement='count-mismatch';
      reason='Loaded rule/Kit counts differ from the applied file.';
    } else {
      engineAgreement='counts-match';
      reason='Loaded counts agree, but the engine does not expose a configuration fingerprint. Exact in-memory equality cannot be verified.';
    }
  }
  const status=appliedHash===null?'not-applied':!draftMatchesApplied?'draft-differs':engineAgreement==='not-loaded'||engineAgreement==='count-mismatch'?'engine-attention':engineAgreement==='counts-match'?'counts-match':'unverified';
  return {
    status,draftMatchesApplied,engineAgreement,reason,
    appliedPresent:appliedHash!==null,
    draft:{ruleCount:null,kitCount:null}, // filled with trusted validated totals by caller
    applied:{ruleCount:appliedRuleCount,kitCount:appliedKitCount},
    engine:engine?.engineOnline?{online:true,loaded:engine.customRulesLoaded,mode:engine.customRulesMode,ruleCount:engine.customRuleCount,kitCount:engine.customKitCount}:{online:false,loaded:false,mode:'unknown',ruleCount:null,kitCount:null},
    checkedAt:new Date().toISOString(),
    note:'Read-only comparison. Matching counts do not establish identical in-memory rules.'
  };
}
