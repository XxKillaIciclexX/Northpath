import { fileURLToPath } from 'node:url';
import { handleInterruption, launchInstalled } from './Test-IcePackCleanInstall.mjs';

const signal = handleInterruption();
try {
  await launchInstalled(fileURLToPath(new URL('./', import.meta.url)), { pilot: true });
} catch (error) {
  if (!signal.aborted) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
    if (process.stdin.isTTY) {
      console.log('Press Enter to close this window.');
      await new Promise(resolve => process.stdin.once('data', resolve));
      process.stdin.pause();
    }
  }
}
