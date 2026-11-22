const byId = (id) => document.getElementById(id);
const form = byId('pair-form');
const input = byId('token');
const pair = byId('pair');
const preview = byId('preview');
let pairedToken = '';

async function post(path, token, body) {
  const response = await fetch(`/api/agent/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-icepack-sync-token': token },
    body: JSON.stringify(body),
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
const draftStatus = byId('draft-status');
const draftActions = byId('draft-actions');
const draftError = byId('draft-error');
let draft;
let gifts = [];

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
  const file = draftFile.files[0];
  if (!file) return;
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    if (file.size > 400_000) throw new Error('Choose a Companion export under 400 KB.');
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
    if (!rules.length) throw new Error('The export has no enabled Gift Rules.');
    // Omit the export's server name, player ID, and other dashboard settings.
    draft = { version: 1, rules: parsed.rules, kits: parsed.kits };
    gifts = rules.map((rule, index) => {
      const gift = { id: rule.giftId ?? '', name: rule.giftName };
      const label = gift.id ? `${gift.name} (ID ${gift.id})` : gift.name;
      draftGift.add(new Option(label, String(index)));
      return gift;
    });
    draftLoaded.textContent = `Loaded ${rules.length} enabled Gift Rules and ${draft.kits.length} Kits for preview.`;
    draftGift.disabled = false;
    draftPreview.disabled = false;
  } catch (error) {
    draftError.textContent = error instanceof SyntaxError ? 'The file is not valid JSON.' : error.message;
  } finally {
    draftControls.disabled = !pairedToken;
    pair.disabled = false;
    preview.disabled = !pairedToken;
  }
});

draftGift.addEventListener('change', clearDraftResult);
draftPreview.addEventListener('click', async () => {
  clearDraftResult();
  draftControls.disabled = true;
  pair.disabled = true;
  preview.disabled = true;
  try {
    const gift = gifts[Number(draftGift.value)];
    const result = await post('draft/preview', pairedToken, { draft, gift });
    const { plan } = result;
    if (!plan.matched) {
      draftStatus.textContent = 'No enabled Gift Rule matched this gift.';
      return;
    }
    draftStatus.textContent = `${plan.gift}: ${plan.actions.length} planned action(s). The draft was not applied.`;
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
