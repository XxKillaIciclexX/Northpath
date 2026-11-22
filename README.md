# Ice Pack Companion v3.3 Alpha — Runtime Readiness

This release adds a **read-only Node.js runtime/dependency preflight** to the existing Northpath installation. It does not replace the engine, Control Center, bridge, dashboard, or any configuration files.

## Install

Extract the ZIP into a temporary location, then copy these **new** files into `D:\Github\XxKillaIciclexX\Northpath\`:

- `scripts\Check-IcePackRuntime.mjs`
- `tests\runtime-readiness.test.mjs`

No existing files are replaced. The original ARK engine stays at `C:\IcePackARK\ice-pack-ark`.

## Run

From PowerShell:

```powershell
cd D:\Github\XxKillaIciclexX\Northpath
node --test .\tests\runtime-readiness.test.mjs
node .\scripts\Check-IcePackRuntime.mjs
```

To inspect another location:

```powershell
node .\scripts\Check-IcePackRuntime.mjs --repo "D:\Github\XxKillaIciclexX\Northpath" --engine "C:\IcePackARK\ice-pack-ark"
```

Optional machine-readable output (no configuration contents included):

```powershell
node .\scripts\Check-IcePackRuntime.mjs --json
```

## What is checked

- Node.js version 20+ (this is a minimum preliminary requirement, not a complete dependency compatibility guarantee).
- Presence of the actual dashboard and engine entry/source files.
- Presence, readability, and root dependency consistency of **both** `package.json` and `package-lock.json`.
- npm lockfile format (v2 or newer) for both components.
- Whether `node_modules` is present (not a validation of installed modules).
- External requirements **not verified**: compatible dedicated ARK server, installed IcePackCompanion ASA mod, Streamer.bot/TikTok integration, RCON authentication and networking.

**No writes** and **no connections**. Does not read `.env`, `rules-v06.json`, Kit data, installed Companion settings, user IDs, pairing tokens, or backups. No installation or RCON actions are performed.

## Important limitations / what's next

A `source-prerequisites-pass` result means **the local source/dependency manifests are consistent**, not that a clean Windows PC can run the product. The standalone installer still needs dependable `npm ci` installation or a bundled runtime, supported Node version constraints for all packages, external ARK server onboarding, actual mod deployment, service installation, and publisher signing. For now, `npm ci` should be tested separately in an isolated copy, *not* by mutating the known-good deployment.

Test results in the packaging environment: 8 tests passed, 0 failed. Runtime check on Windows must be verified by the user.

## v3.8 Alpha — Preview a draft with your Kit Editor catalog

The v3.7 Windows checklist passed, including pairing, Heart Me Preview, exported Kit preview, and shutdown.

Use Node.js 22.12 or newer and the same verified v3.1 Companion and v3.2 ARK Engine source ZIPs from the v3.4 and v3.5 tests. From the Northpath checkout in PowerShell:

```powershell
node --test .\tests\alpha-installer.test.mjs .\tests\runtime-readiness.test.mjs .\companion\agent-bridge\test\preview-safety.test.mjs .\companion\agent-bridge\test\draft-preview.test.mjs

node .\scripts\Install-IcePackAlpha.mjs `
  --companion "C:\path\to\companion-source.zip" --companion-sha256 "<trusted companion ZIP SHA-256>" `
  --engine "C:\path\to\engine-source.zip" --engine-sha256 "<trusted engine ZIP SHA-256>"
```

The installer checks both ZIPs before extraction, stages the updated Bridge and pairing page, installs dependencies from both lockfiles, and builds the Dashboard. It publishes to `%LOCALAPPDATA%\IcePackCompanion\alpha-installs\v3.8` after the build. Use `--install-root` to select another parent directory. An existing v3.8 installation is preserved.

1. Wait for both ZIP hash checks and `PASS installed Ice Pack Companion v3.8 Alpha`.
2. Stop your usual Companion through the Control Center so ports 3210 and 3212 are free. Leave port 5174 free for the new Dashboard.
3. Start the installed launcher.

   ```powershell
   node "$env:LOCALAPPDATA\IcePackCompanion\alpha-installs\v3.8\Install-IcePackAlpha.mjs" --start
   ```

4. Open `http://127.0.0.1:5174/first-run.html`. Paste the token from this launcher window into **Pairing token**, then click **Pair Dashboard**. The page should say **Dashboard paired for this session**.
5. Click **Run Heart Me Preview**. Expect **The engine preview planned 25 Stone. No game command was sent.**
6. Open **Preview your Gift Rules and Kits**, choose a version 1 file saved with **Export JSON** in the usual Dashboard, select a Gift Rule, and click **Preview draft gift**. Check that the actions and quantities match your draft. A Kit expands to its item and creature actions. For a rule that uses entries outside the bundled catalog, select **Kit Editor catalog (optional)** and choose your Kit Editor’s version 2 catalog JSON, typically `ark-catalog-v2.json`. Repeat the preview and confirm the result says **using the selected catalog**.
7. Press Ctrl+C in the launcher. Confirm Windows has released the three ports.

   ```powershell
   Get-NetTCPConnection -State Listen -LocalPort 3210,3212,5174 -ErrorAction SilentlyContinue |
       Select-Object LocalAddress, LocalPort, OwningProcess
   ```

The sample setup uses its own rule, catalog and placeholder target. It starts in the engine's Preview mode, with live RCON settings absent. The token is generated per launch, kept in memory by the pairing page, and should stay private. A restart requires a new token.

The draft preview defaults to the bundled catalog. A selected Kit Editor catalog replaces it for that preview, and **Use bundled catalog** resets the selection. The combined request has a 400 KB limit. It returns a plan and leaves the engine's loaded rules, files, and modes alone. If validation rejects a missing catalog entry or an unsupported action setting, the page displays the reason without applying the draft.
