export type ReconciliationGuide = {key:string;action:'preview'|'none';showRecovery:boolean;summary:string;steps:string[]};
export function getReconciliationGuide(drift: {draftMatchesApplied:boolean|null;appliedPresent:boolean;engineAgreement:string;engine?:{online:boolean}}): ReconciliationGuide;
