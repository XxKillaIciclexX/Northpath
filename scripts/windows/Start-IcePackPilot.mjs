import { fileURLToPath } from 'node:url';
import { handleInterruption, launchInstalled } from './Test-IcePackCleanInstall.mjs';
import { prepareWebsiteConnection } from './WebsiteConnection.mjs';

const signal = handleInterruption();
try {
  const root = fileURLToPath(new URL('./', import.meta.url));
  const websiteConnection = await prepareWebsiteConnection(root);
  signal.throwIfAborted();
  await launchInstalled(root, { pilot: true, websiteConnection });
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
