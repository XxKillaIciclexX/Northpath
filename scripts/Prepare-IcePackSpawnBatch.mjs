import { parseArgs } from 'node:util';
import catalog from '../companion/src/reviewed-catalog.json' with { type: 'json' };
import batch from '../mod-devkit/spawn-batch-01.json' with { type: 'json' };

const help = 'Usage: node scripts/Prepare-IcePackSpawnBatch.mjs [--player-id <Specimen Implant ID> | --csv]';

function prepare({ 'player-id': selectedId, csv }) {
  if (csv && selectedId !== undefined) throw new Error('Generate the Data Table CSV separately from the player-specific test commands.');
  if (selectedId !== undefined && (!/^[1-9][0-9]{0,9}$/.test(selectedId) || Number(selectedId) > 4294967295)) {
    throw new Error('Use a numeric Specimen Implant ID between 1 and 4294967295.');
  }
  const playerId = selectedId ?? '<SURVIVOR_ID>';
  const baseline = batch.baseline.map(id => ({ id, testLevel: 25 }));
  const tests = [...baseline, ...batch.additions];
  if (new Set(tests.map(test => test.id)).size !== tests.length) throw new Error('The batch contains a duplicate creature token.');

  const creatures = new Map(catalog.dinosaurs.map(creature => [creature.id, creature]));
  const rows = tests.map(test => {
    const creature = creatures.get(test.id);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(test.id) || !Number.isInteger(test.testLevel) || test.testLevel < 1 || test.testLevel > 150 ||
      !creature?.enabled || !creature.verified || creature.contentPack !== 'base-game' ||
      !/^\/Game(?:\/[A-Za-z0-9_]+)+\.[A-Za-z0-9_]+_C$/.test(creature.blueprint)) {
      throw new Error('Expected a verified base-game creature class and valid test level for ' + test.id + '.');
    }
    return { ...test, blueprint: creature.blueprint };
  });

  if (csv) {
    console.log(['Name,SpawnClass', ...rows.map(({ id, blueprint }) =>
      `${id},"/Script/Engine.BlueprintGeneratedClass'${blueprint}'"`)].join('\n'));
    return;
  }

  console.log('Ice Pack Companion spawn batch 01 · CurseForge project ' + batch.curseForgeProjectId);
  console.log('Class reference for each row');
  for (const { id, blueprint } of rows) console.log(`${id}  ${blueprint}`);

  console.log('\nDevKit console · send each command separately, at least six seconds apart');
  console.log('cheat ScriptCommand IcePackListPlayers');
  for (const { id, testLevel } of rows) console.log(`cheat ScriptCommand IcePackSpawn,${id},${testLevel},${playerId}`);
  console.log('\nOne-survivor format · run with exactly one survivor online');
  for (const { id, testLevel } of batch.additions) console.log(`cheat ScriptCommand IcePackSpawn,${id},${testLevel}`);
  console.log('\nExpected to reject without spawning');
  console.log(`cheat ScriptCommand IcePackSpawn,IcePackUnknownSpecies,25,${playerId}`);
  console.log(`cheat ScriptCommand IcePackSpawn,Parasaur,151,${playerId}`);

  console.log('\nDedicated server RCON · use the active test server Survivor ID');
  for (const { id, testLevel } of rows) console.log(`ScriptCommand IcePackSpawn,${id},${testLevel},${playerId}`);
}

try {
  const { values } = parseArgs({ options: { 'player-id': { type: 'string' }, csv: { type: 'boolean' }, help: { type: 'boolean' } } });
  if (values.help) console.log(help);
  else prepare(values);
} catch (error) {
  console.error(error.message);
  console.error(help);
  process.exitCode = 1;
}
