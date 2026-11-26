import { writeFile } from 'node:fs/promises';
import reviewed from '../companion/src/reviewed-catalog.json' with { type: 'json' };

const blueprintPath = /^\/Game(?:\/[A-Za-z0-9_]+)+\.[A-Za-z0-9_]+$/;
const items = reviewed.items.filter(entry => entry.enabled && entry.verified && entry.contentPack === 'base-game' &&
  /^[A-Za-z0-9_-]+$/.test(entry.id) && typeof entry.blueprint === 'string' && blueprintPath.test(entry.blueprint));
const rows = items.map(({ id, name, category, blueprint }) => '  ' + JSON.stringify({ id, name, category, blueprint }));
await writeFile(new URL('../relay/hosted-items.json', import.meta.url), '[\n' + rows.join(',\n') + '\n]\n');
console.log('Exported ' + items.length + ' hosted items.');
