// v1.8: Pure guidance based only on the read-only v1.7 drift response.
// No network requests or mutation permissions. Do not mistake matching counts for exact memory equality.
export function getReconciliationGuide(drift) {
  if (!drift || typeof drift !== 'object') throw new TypeError('A drift result is required');
  // A changed draft has priority. Even if engine counts disagree, first decide whether to publish edits.
  if (drift.draftMatchesApplied === false) return {
    key:'draft-edits', action:'preview', showRecovery:false,
    summary:'Your browser has edits that are not in the applied configuration. Nothing has been changed on the server.',
    steps:['Review Gift Rules and Kits to make sure the browser draft is intentional.',
      'Use Validate & preview draft to check supported actions. This does not apply changes.',
      'If correct, review the approval shown above and use Apply approved configuration manually; it creates a protected snapshot first.',
      'Recheck synchronization after the engine reloads.']
  };
  if (!drift.appliedPresent) return {
    key:'not-applied', action:'preview', showRecovery:true,
    summary:'No applied configuration file was found. Do not assume the engine is using this browser draft.',
    steps:['Review Gift Rules and Kits before creating the first applied file.',
      'Use Validate & preview draft; then explicitly approve Apply if you want to publish it.',
      'Alternatively, open Recovery to inspect older snapshots. Restores require a stopped engine.']
  };
  if (drift.engineAgreement === 'count-mismatch') return {
    key:'count-mismatch', action:'none', showRecovery:true,
    summary:'The running engine reports different rule or Kit counts than the saved file. Do not overwrite your saved configuration merely to hide the mismatch.',
    steps:['Stop any Live reward processing before maintenance; check whether a reload is pending.',
      'Restart the engine through the existing Control Center to load the saved file, then recheck.',
      'If the mismatch remains, inspect engine logs and use Recovery to compare snapshots before choosing a manual repair.']
  };
  if (drift.engineAgreement === 'not-loaded') return {
    key:'not-loaded', action:'none', showRecovery:true,
    summary:'The engine is reachable, but it does not confirm that Custom Rules are loaded.',
    steps:['Check original engine logs for errors loading the Kit configuration.',
      'Verify the configured Kit directory and restart the engine if appropriate, without enabling Live.',
      'Recheck; use Recovery to investigate any damaged or missing configuration file.']
  };
  if (!drift.engine?.online) return {
    key:'engine-offline', action:'none', showRecovery:false,
    summary:'Northpath can inspect the applied file, but cannot confirm what the offline engine has loaded.',
    steps:['Start the engine using the existing Windows Control Center.',
      'Confirm service health and pairing in Connections.',
      'Recheck after the engine comes online; do not interpret offline as synchronized.']
  };
  if (drift.engineAgreement === 'counts-match' && drift.draftMatchesApplied === true) return {
    key:'counts-agree', action:'none', showRecovery:false,
    summary:'Your browser matches the applied file and the engine reports matching counts. No reconciliation action is indicated.',
    steps:['You can continue editing or use safe Preview mode.',
      'Remember: equal counts do not prove identical loaded rule content.']
  };
  return {key:'unverified', action:'none', showRecovery:true,
    summary:'Configuration agreement has not been verified. Avoid applying changes solely to clear this status.',
    steps:['Recheck the service and bridge health.', 'Inspect logs or compare a Recovery snapshot if the status persists.']};
}
