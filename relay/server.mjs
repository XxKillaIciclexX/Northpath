import { readConfig } from './config.mjs';
import { connectRcon } from './rcon.mjs';
import { createRelay } from './relay.mjs';
import { createStore } from './supabase.mjs';

try {
  const config = readConfig(process.env);
  const server = createRelay({ config, store: createStore(config), connect: connectRcon });
  server.on('error', () => { console.error('Could not start the relay HTTP listener.'); process.exitCode = 1; });
  server.listen(config.port, '0.0.0.0', () => console.log('Northpath relay listening on port ' + config.port));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
