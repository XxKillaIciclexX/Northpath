const byId = (id) => document.getElementById(id);
const form = byId('pair-form');
const input = byId('token');
const pair = byId('pair');
const preview = byId('preview');
let pairedToken = '';
const maxDraftBytes = 400_000;

async function post(path, token, body) {
  const payload = JSON.stringify(body);
  if (path.startsWith('draft/') && new TextEncoder().encode(payload).length > maxDraftBytes) {
    throw new Error('The draft and catalog exceed the combined 400 KB limit.');
  }
  const response = await fetch(`/api/agent/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-icepack-sync-token': token },
    body: payload,
  });
  if (response.status === 401) throw new Error('Paste the token from the current launcher session.');
  const result = await response.json();
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'The Local Bridge is unavailable.');
  return result;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = input.value.trim();
  pair.disabled = true;
  preview.disabled = true;
  pairedToken = '';
  draftControls.disabled = true;
  clearDraftResult();
  clearExport();
  byId('pair-status').textContent = '';
  byId('pair-error').textContent = '';
  byId('preview-status').textContent = '';
  byId('preview-error').textContent = '';
  try {
    await post('pairing/check', token, {});
    pairedToken = token;
    draftControls.disabled = false;
    input.value = '';
    byId('pair-status').textContent = 'Dashboard paired for this session.';
    preview.disabled = false;
  } catch (error) {
    byId('pair-error').textContent = error.message;
  } finally {
    pair.disabled = false;
  }
});

preview.addEventListener('click', async () => {
  preview.disabled = true;
  input.disabled = true;
  pair.disabled = true;
  draftControls.disabled = true;
  byId('preview-status').textContent = '';
  byId('preview-error').textContent = '';
  try {
    const result = await post('simulate/preview', pairedToken, { id: '', name: 'Heart Me' });
    if (result.previewOnly !== true) throw new Error('The engine did not confirm Preview mode.');
    byId('preview-status').textContent = result.message;
  } catch (error) {
    byId('preview-error').textContent = error.message;
  } finally {
    preview.disabled = false;
    input.disabled = false;
    pair.disabled = false;
    draftControls.disabled = !pairedToken;
  }
});

const draftControls = byId('draft-controls');
const draftFile = byId('draft-file');
const draftGift = byId('draft-gift');
const draftPreview = byId('draft-preview');
const draftLoaded = byId('draft-loaded');
const catalogFile = byId('draft-catalog');
const resetCatalog = byId('reset-catalog');
const catalogSource = byId('catalog-source');
const draftStatus = byId('draft-status');
const draftActions = byId('draft-actions');
const draftError = byId('draft-error');
const reviewExport = byId('review-export');
const downloadExport = byId('download-export');
const rehearseExport = byId('rehearse-export');
const rehearsalStatus = byId('rehearsal-status');
const rehearsalRules = byId('rehearsal-rules');
const rehearsalError = byId('rehearsal-error');
const exportStatus = byId('export-status');
const exportNotes = byId('export-notes');
const exportError = byId('export-error');
let draft;
let gifts = [];
let catalog;
let reviewedConfig;

function updateDraftButtons() {
  const unavailable = !draft || (catalogFile.files.length > 0 && !catalog);
  draftPreview.disabled = unavailable || gifts.length === 0;
  reviewExport.disabled = unavailable;
}

function clearExport() {
  reviewedConfig = undefined;
  downloadExport.disabled = true;
  rehearseExport.disabled = true;
  clearRehearsal();
  exportStatus.textContent = '';
  exportNotes.replaceChildren();
  exportNotes.hidden = true;
  exportError.textContent = '';
}

function clearRehearsal() {
  rehearsalStatus.textContent = '';
  rehearsalError.textContent = '';
  rehearsalRules.replaceChildren();
  rehearsalRules.hidden = true;
}

function clearDraftResult() {
  draftStatus.textContent = '';
  draftError.textContent = '';
  draftActions.replaceChildren();
  draftActions.hidden = true;
}

draftFile.addEventListener('change', async () => {
  draft = undefined;
  gifts = [];
  draftGift.replaceChildren();
  draftGift.disabled = true;
  draftPreview.disabled = true;
  draftLoaded.textContent = '';
  clearDraftResult();
  clearExport();
  updateDraftButtons();
  const file = draftFile.files[0];
  if (!file) return;
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    if (file.size > maxDraftBytes) throw new Error('Choose a Companion export under 400 KB.');
    const parsed = JSON.parse(await file.text());
    if (parsed?.version !== 1 || !Array.isArray(parsed.rules) || !Array.isArray(parsed.kits)) {
      throw new Error('Choose a version 1 JSON export from the Companion Dashboard.');
    }
    if (parsed.rules.length > 500 || parsed.kits.length > 200) {
      throw new Error('This export exceeds the limit of 500 Gift Rules or 200 Kits.');
    }
    const rules = parsed.rules.filter((rule) =>
      rule?.enabled === true && typeof rule.giftName === 'string' && rule.giftName.trim()
    );
    // Omit the export's server name, player ID, and other dashboard settings.
    draft = { version: 1, rules: parsed.rules, kits: parsed.kits };
    gifts = rules.map((rule, index) => {
      const gift = { id: rule.giftId ?? '', name: rule.giftName };
      const label = gift.id ? `${gift.name} (ID ${gift.id})` : gift.name;
      draftGift.add(new Option(label, String(index)));
      return gift;
    });
    draftLoaded.textContent = `Loaded ${rules.length} enabled Gift Rules and ${draft.kits.length} Kits for preview.`;
    draftGift.disabled = gifts.length === 0;
  } catch (error) {
    draftError.textContent = error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message;
  } finally {
    updateDraftButtons();
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

catalogFile.addEventListener('change', async () => {
  catalog = undefined;
  clearDraftResult();
  clearExport();
  updateDraftButtons();
  const file = catalogFile.files[0];
  resetCatalog.hidden = !file;
  if (!file) {
    catalogSource.textContent = 'Using the bundled catalog.';
    return;
  }
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    if (file.size > maxDraftBytes) throw new Error('Choose a catalog under 400 KB.');
    const parsed = JSON.parse(await file.text());
    if (parsed?.schemaVersion !== 2 || !Array.isArray(parsed.items) || !Array.isArray(parsed.dinosaurs)) {
      throw new Error('Choose a version 2 ARK catalog exported by Kit Editor.');
    }
    catalog = parsed;
    catalogSource.textContent = `Selected catalog: ${file.name}`;
  } catch (error) {
    catalogSource.textContent = 'The selected catalog could not be loaded.';
    draftError.textContent = error instanceof SyntaxError ? 'The catalog file is not valid JSON.' : error.message;
  } finally {
    updateDraftButtons();
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

resetCatalog.addEventListener('click', () => {
  catalogFile.value = '';
  catalog = undefined;
  resetCatalog.hidden = true;
  catalogSource.textContent = 'Using the bundled catalog.';
  clearDraftResult();
  clearExport();
  updateDraftButtons();
});

draftGift.addEventListener('change', clearDraftResult);
draftPreview.addEventListener('click', async () => {
  clearDraftResult();
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    const gift = gifts[Number(draftGift.value)];
    const result = await post('draft/preview', pairedToken, { draft, gift, catalog });
    const { plan } = result;
    if (!plan.matched) {
      draftStatus.textContent = 'No enabled Gift Rule matched this gift.';
      return;
    }
    const source = plan.catalogSource === 'provided' ? 'selected catalog' : 'bundled catalog';
    draftStatus.textContent = `${plan.gift}: ${plan.actions.length} planned action(s) using the ${source}.`;
    for (const action of plan.actions) {
      const item = document.createElement('li');
      item.textContent = action.type === 'item'
        ? `Give ${action.quantity} × ${action.itemId}`
        : `Spawn ${action.quantity} × ${action.status} ${action.creatureId}, level ${action.level}`;
      draftActions.append(item);
    }
    draftActions.hidden = plan.actions.length === 0;
  } catch (error) {
    draftError.textContent = error.message;
  } finally {
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

reviewExport.addEventListener('click', async () => {
  clearExport();
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    const { draftExport } = await post('draft/export', pairedToken, { draft, catalog });
    const { config, catalogSource, warnings } = draftExport;
    const source = catalogSource === 'provided' ? 'selected catalog' : 'bundled catalog';
    const enabled = config.rules.filter(rule => rule.enabled).length;
    exportStatus.textContent = `Version 2 draft ready. ${config.rules.length} rules (${enabled} enabled), ${config.kits.length} Kits, validated against the ${source}.`;
    const cooldownNote = 'Rules use a 0-second cooldown because Dashboard exports do not supply an engine cooldown.';
    for (const note of [cooldownNote, ...warnings]) {
      const item = document.createElement('li');
      item.textContent = note;
      exportNotes.append(item);
    }
    exportNotes.hidden = false;
    reviewedConfig = config;
    downloadExport.disabled = false;
    rehearseExport.disabled = false;
  } catch (error) {
    exportError.textContent = error.message;
  } finally {
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

rehearseExport.addEventListener('click', async () => {
  clearRehearsal();
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    const { report } = await post('draft/rehearse', pairedToken, { config: reviewedConfig, catalog });
    const blocked = report.results.filter(row => row.blocked !== undefined).length;
    const prepared = report.results.length - blocked;
    const disabled = report.ruleCount - report.results.length;
    rehearsalStatus.textContent =
      `Rehearsal: ${prepared} prepared, ${blocked} blocked, ${disabled} disabled. No game commands sent. Content packs: catalog defaults.`;
    for (const row of report.results) {
      const item = document.createElement('li');
      item.textContent = row.blocked === undefined
        ? `${row.gift}: prepared ${row.prepared} command(s)`
        : `${row.gift}: blocked — ${row.blocked}`;
      rehearsalRules.append(item);
    }
    rehearsalRules.hidden = report.results.length === 0;
  } catch (error) {
    rehearsalError.textContent = error.message;
  } finally {
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

downloadExport.addEventListener('click', () => {
  if (!reviewedConfig) return;
  const file = new Blob([JSON.stringify(reviewedConfig, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'icepack-engine-draft-v2.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
