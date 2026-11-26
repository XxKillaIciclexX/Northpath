import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import catalog from '../companion/src/reviewed-catalog.json' with { type: 'json' };
import firstBatch from '../mod-devkit/spawn-batch-01.json' with { type: 'json' };
import secondBatch from '../mod-devkit/spawn-batch-02.json' with { type: 'json' };

const help = [
  'Usage: node scripts/Prepare-IcePackSpawnBatch.mjs [--batch 01|02] [--player-id <Specimen Implant ID>]',
  '       node scripts/Prepare-IcePackSpawnBatch.mjs --csv [--pack <catalog pack ID>] [--batch 01|02] [--hard-class]',
  '       node scripts/Prepare-IcePackSpawnBatch.mjs --check-csv <file> [--pack <catalog pack ID>] [--batch 01|02]',
].join('\n');

const creatures = new Map(catalog.dinosaurs.map(creature => [creature.id, creature]));
const classPath = /^\/Game(?:\/[A-Za-z0-9_-]+)+\.[A-Za-z0-9_]+$/;
const baseline = firstBatch.baseline.map(id => ({ id, testLevel: 25 }));

function batchTests(batchNumber) {
  return [...baseline, ...firstBatch.additions, ...(batchNumber === '02' ? secondBatch.additions : [])];
}

function spawnRows(tests) {
  const keys = new Set();
  return tests.map(test => {
    const creature = creatures.get(test.id);
    const key = test.id.toLowerCase();
    if (keys.has(key)) throw new Error('Duplicate Data Table row name ' + test.id + '.');
    keys.add(key);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(test.id) || !Number.isInteger(test.testLevel) || test.testLevel < 1 || test.testLevel > 150 ||
      !creature?.enabled || !creature.verified || !catalog.packs.some(pack => pack.id === creature.contentPack) ||
      typeof creature.blueprint !== 'string' || !classPath.test(creature.blueprint)) {
      throw new Error('Expected a verified dashboard creature class and valid test level for ' + test.id + '.');
    }
    const blueprint = creature.blueprint.endsWith('_C') ? creature.blueprint : creature.blueprint + '_C';
    return { ...test, blueprint };
  });
}

function decodeCsv(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer);
  return new TextDecoder().decode(buffer);
}

function parseCsvPair(line) {
  const fields = /^("(?:[^"]|"")*"|[^",]*),("(?:[^"]|"")*"|[^",]*)$/.exec(line);
  if (!fields) return null;
  return fields.slice(1).map(field => field.startsWith('"') ? field.slice(1, -1).replace(/""/g, '"') : field.trim());
}

async function checkCsv(path, rows) {
  const [header, ...lines] = decodeCsv(await readFile(path)).trim().split(/\r?\n/);
  const columns = parseCsvPair(header);
  if (!columns || !['name', '---', ''].includes(columns[0].toLowerCase()) ||
    !/^(?:soft\s*)?spawn\s*class(?:_\d+_[a-f0-9]{32})?$/i.test(columns[1])) {
    throw new Error('Expected a DevKit export with row names followed by the SoftSpawnClass or SpawnClass column.');
  }
  const expected = new Map(rows.map(row => [row.id.toLowerCase(), row]));
  const seen = new Set();
  const issues = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const fields = parseCsvPair(line);
    if (!fields) {
      issues.push('Invalid CSV row on line ' + (index + 2) + '.');
      continue;
    }
    const [name, value] = fields;
    const key = name.toLowerCase();
    const row = expected.get(key);
    if (seen.has(key)) issues.push('Duplicate row ' + name + '.');
    seen.add(key);
    if (!row) {
      issues.push('Unexpected row ' + name + '.');
      continue;
    }
    // Unreal exports can use a bare object path or a class-qualified reference.
    const actual = /^(?:(?:\/Script\/Engine\.)?BlueprintGeneratedClass|Class)?'([^']+)'$/.exec(value)?.[1] ?? value;
    if (actual !== row.blueprint) {
      issues.push(`${row.id} has ${value && value !== 'None' ? value : 'an empty class'}. Expected ${row.blueprint}.`);
    }
  }
  for (const [key, row] of expected) {
    if (!seen.has(key)) issues.push('Missing row ' + row.id + '.');
  }
  if (issues.length) {
    for (const issue of issues.slice(0, 12)) console.error(issue);
    throw new Error(`Data Table audit found ${issues.length} issues. Expected ${rows.length} rows.`);
  }
  console.log(`PASS: ${rows.length} Data Table rows match the expected generated class paths.`);
}

function printTests(batchNumber, rows, playerId) {
  const additions = batchNumber === '02' ? secondBatch.additions : firstBatch.additions;
  console.log('Ice Pack Companion spawn batch ' + batchNumber + ' · CurseForge project ' + firstBatch.curseForgeProjectId);
  console.log('Class reference for each row');
  for (const { id, blueprint } of rows) console.log(`${id}  ${blueprint}`);

  console.log('\nDevKit console · send each command separately, at least six seconds apart');
  console.log('cheat ScriptCommand IcePackListPlayers');
  for (const { id, testLevel } of rows) console.log(`cheat ScriptCommand IcePackSpawn,${id},${testLevel},${playerId}`);
  console.log('\nOne-survivor format · run with exactly one survivor online');
  for (const { id, testLevel } of additions) console.log(`cheat ScriptCommand IcePackSpawn,${id},${testLevel}`);
  console.log('\nExpected to reject without spawning');
  console.log(`cheat ScriptCommand IcePackSpawn,IcePackUnknownSpecies,25,${playerId}`);
  console.log(`cheat ScriptCommand IcePackSpawn,Parasaur,151,${playerId}`);

  console.log('\nDedicated server RCON · use the active test server Survivor ID');
  for (const { id, testLevel } of rows) console.log(`ScriptCommand IcePackSpawn,${id},${testLevel},${playerId}`);
}

async function prepare({ 'player-id': selectedId, 'check-csv': checkPath, 'hard-class': hardClass, batch, pack, csv }) {
  const tableMode = csv || checkPath !== undefined;
  if (csv && checkPath !== undefined) throw new Error('Choose either --csv or --check-csv.');
  if (hardClass && !csv) throw new Error('Use --hard-class with --csv to generate a hard-reference table.');
  if (tableMode && selectedId !== undefined) throw new Error('Use --player-id when generating spawn test commands.');
  if (pack !== undefined && (!tableMode || !catalog.packs.some(entry => entry.id === pack))) {
    throw new Error('Use a catalog pack ID with --csv or --check-csv.');
  }
  const batchNumber = batch ?? '01';
  if (batchNumber !== '01' && batchNumber !== '02') throw new Error('Choose spawn batch 01 or 02.');
  if (selectedId !== undefined && (!/^[1-9][0-9]{0,9}$/.test(selectedId) || Number(selectedId) > 4294967295)) {
    throw new Error('Use a numeric Specimen Implant ID between 1 and 4294967295.');
  }
  if (!tableMode) {
    printTests(batchNumber, spawnRows(batchTests(batchNumber)), selectedId ?? '<SURVIVOR_ID>');
    return;
  }

  const tests = batch === undefined ?
    catalog.dinosaurs.filter(entry => entry.enabled && entry.verified).map(entry => ({ id: entry.id, testLevel: 25 })) :
    batchTests(batchNumber);
  const rows = spawnRows(pack === undefined ? tests : tests.filter(test => creatures.get(test.id)?.contentPack === pack));
  if (checkPath !== undefined) {
    await checkCsv(checkPath, rows);
  } else {
    const heading = hardClass ? 'Name,SpawnClass' : 'Name,SoftSpawnClass';
    const cells = rows.map(({ id, blueprint }) =>
      hardClass ? `${id},"/Script/Engine.BlueprintGeneratedClass'${blueprint}'"` : `${id},${blueprint}`);
    console.log([heading, ...cells].join('\n'));
  }
}

try {
  const { values } = parseArgs({ options: {
    'player-id': { type: 'string' }, 'check-csv': { type: 'string' }, batch: { type: 'string' },
    pack: { type: 'string' }, csv: { type: 'boolean' }, 'hard-class': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) console.log(help);
  else await prepare(values);
} catch (error) {
  console.error(error.message);
  console.error(help);
  process.exitCode = 1;
}
