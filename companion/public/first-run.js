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
  byId('pair-status').textContent = '';
  byId('pair-error').textContent = '';
  byId('preview-status').textContent = '';
  byId('preview-error').textContent = '';
  try {
    await post('pairing/check', token, {});
    pairedToken = token;
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
  }
});
