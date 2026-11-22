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

## v4.9 Alpha — Rehearse drafts from the Dashboard

The v4.8 Windows checkout-updater checks passed. The updater still uses the verified engine files in the Git checkout directly. To check whether your regular Control Center engine needs an update, pull `development` and run this from the Northpath checkout:

```powershell
git pull --ff-only origin development
node .\scripts\Update-IcePackEngine.mjs
```

Check **Target engine**, **Update source**, and both file statuses. A verified v4.7 engine reports `CURRENT` for both files in v4.9. If a subsequent release reports `UPDATE`, stop the engine and rerun with `--apply`. The checkout updater uses the same hash checks, backup, and restore as the installed alpha updater.

### Build a separate alpha preview install

Use Node.js 22.12 or newer and the same verified v3.1 Companion and v3.2 ARK Engine source ZIPs from the v3.4 and v3.5 tests. From the Northpath checkout in PowerShell:

```powershell
node --test .\tests\alpha-installer.test.mjs .\tests\runtime-readiness.test.mjs .\tests\engine-draft-rehearsal.test.mjs .\tests\engine-updater.test.mjs .\companion\agent-bridge\test\preview-safety.test.mjs .\companion\agent-bridge\test\draft-preview.test.mjs

node .\scripts\Install-IcePackAlpha.mjs `
  --companion "C:\path\to\companion-source.zip" --companion-sha256 "<trusted companion ZIP SHA-256>" `
  --engine "C:\path\to\engine-source.zip" --engine-sha256 "<trusted engine ZIP SHA-256>"
```

The installer checks both ZIPs before extraction, stages the updated Bridge and pairing page, installs dependencies from both lockfiles, and builds the Dashboard. It publishes to `%LOCALAPPDATA%\IcePackCompanion\alpha-installs\v4.9` after the build. Use `--install-root` to select another parent directory. An existing v4.9 installation is preserved.

1. Wait for both ZIP hash checks and `PASS installed Ice Pack Companion v4.9 Alpha`.
2. Stop your usual Companion through the Control Center so ports 3210 and 3212 are free. Leave port 5174 free for the new Dashboard.
3. Start the installed launcher.

   ```powershell
   node "$env:LOCALAPPDATA\IcePackCompanion\alpha-installs\v4.9\Install-IcePackAlpha.mjs" --start
   ```

4. Open `http://127.0.0.1:5174/first-run.html`. Paste the token from this launcher window into **Pairing token**, then click **Pair Dashboard**. The page should say **Dashboard paired for this session**.
5. Click **Run Heart Me Preview**. Expect **The engine preview planned 25 Stone. No game command was sent.**
6. Open **Preview your Gift Rules and Kits**, choose a version 1 file saved with **Export JSON** in the usual Dashboard, select a Gift Rule, and click **Preview draft gift**. Check that the actions and quantities match your draft. A Kit expands to its item and creature actions. For a rule that uses entries outside the bundled catalog, select **Kit Editor catalog (optional)** and choose your Kit Editor’s version 2 catalog JSON, typically `ark-catalog-v2.json`. Repeat the preview and confirm the result says **using the selected catalog**.
7. Click **Review engine draft**. Check the total and enabled rule counts, Kit count, catalog source, and any conversion warnings. Then click **Download engine draft** and open `icepack-engine-draft-v2.json` to confirm `schemaVersion` is 2 and the expected rules and Kits are present.
8. Press Ctrl+C in the launcher. Confirm Windows has released the three ports.

   ```powershell
   Get-NetTCPConnection -State Listen -LocalPort 3210,3212,5174 -ErrorAction SilentlyContinue |
       Select-Object LocalAddress, LocalPort, OwningProcess
   ```

The sample setup uses its own rule, catalog and placeholder target. It starts in the engine's Preview mode, with live RCON settings absent. The token is generated per launch, kept in memory by the pairing page, and should stay private. A restart requires a new token.

The draft preview defaults to the bundled catalog. A selected Kit Editor catalog replaces it for that preview, and **Use bundled catalog** resets the selection. The combined request has a 400 KB limit. It returns a plan and leaves the engine's loaded rules, files, and modes alone. If validation rejects a missing catalog entry or an unsupported action setting, the page displays the reason without applying the draft.

The download contains only the version 2 rules and Kits. Dashboard exports do not provide engine cooldowns, so the conversion uses 0 seconds. Warnings describe current engine compatibility limits. The export workflow does not apply the file or reload the engine.

### Run a rehearsal on a downloaded draft

The rehearsal can run while your usual Companion is open. There is no need to start the alpha Dashboard. Use the same Kit Editor catalog you selected for the draft review, or omit `--catalog` if the review used the bundled catalog.

```powershell
$alpha = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\alpha-installs\v4.9'
node "$alpha\Test-IcePackEngineDraft.mjs" `
  --draft "$env:USERPROFILE\Downloads\icepack-engine-draft-v2.json" `
  --catalog "C:\path\to\ark-catalog-v2.json"
```

Optionally pass `--content-prefs` with your Kit Editor's `content-prefs.json` to use its enabled content packs. Otherwise the rehearsal uses catalog defaults. The bundled Engine reads isolated copies from a temporary folder and attempts to prepare each enabled rule. The report counts prepared commands, lists the engine's reason for each blocked rule, and skips disabled rules. The report does not print command bodies or verify live delivery. No services start. The temporary folder is removed before the report prints.

Exit codes are `0` when all enabled rules can prepare commands, `2` when one or more are blocked, and `1` when the files cannot be loaded or the rehearsal cannot run.

For a Rose rule that requests two supported wild dinosaurs, rerun the rehearsal on the same version 2 draft. Expect `PREPARED Rose: 2 command(s)`. Each dinosaur consumes one command slot. Each item action consumes one slot regardless of item quantity. The engine accepts up to eight commands per gift, including all Kit entries. The live custom-rules lane waits at least six seconds after each dinosaur RCON send completes before sending the next dinosaur. Stop cancels any remaining spawns waiting in that lane. Use one spawn path at a time when testing with the ASA mod.

### Check delivery progress

With the alpha services running, open `http://127.0.0.1:3210/` and find **Custom Gift Rules → Active delivery**. The panel shows **No active gift** while idle and during simulated gifts. On an engine running live Custom Gift Rules, it shows completed sends and how long until the next dinosaur can be sent. **Last delivery** shows completed sends, a canceled remainder, or an RCON failure. The send count reflects the engine's RCON results. Confirm the spawns in-game.

### Update the regular engine

Run the dry run first. The updater discovers the engine path from Control Center settings. Use `--engine` with an explicit folder to test against a spare engine copy. The dry run prints the target and whether each of the two files needs an update.

```powershell
$updater = "$env:LOCALAPPDATA\IcePackCompanion\alpha-installs\v4.9\Update-IcePackEngine.mjs"
node "$updater"
```

Stop Companion through the Control Center before applying. The updater checks the established file versions, backs up both files inside the target engine folder, and verifies replacements. It stops on unrecognized edits and leaves the engine configuration and Kit Editor untouched.

```powershell
node "$updater" --apply
```

Save the printed `Backup:` path. Restart through the Control Center and check **Custom Gift Rules → Active delivery** at `http://127.0.0.1:3210/`. To restore both saved source files, stop the engine, preview the restore, and then apply it:

```powershell
$backup = (Read-Host 'Backup folder printed by the updater').Trim('"')
node "$updater" --restore "$backup"
node "$updater" --restore "$backup" --apply
```

The ARK Engine dashboard’s **Recent gift deliveries** section keeps the last 20 outcomes until restart. It distinguishes completed sends, partial sends stopped by the operator, RCON failures, cancellations before sending, and gifts that expired before sending. Preview events stay in the event log.

After at least one real delivery outcome, expand **Recent gift deliveries** and select **Download delivery history**. Open the JSON and verify `schemaVersion` is 1 and the gift, counts, and outcome match the table. The file is generated in the browser and uses UTC timestamps. It omits command bodies, player IDs, and raw events. The history still resets when the engine restarts.

Under **Recent gift deliveries → Review a saved report**, choose a version 1 JSON export from v4.5 or later. The saved report shows separately below the current session table and is read locally in your browser. The page rejects an invalid file and clears the previous saved view. The download button continues to export current session outcomes.

Under **Recent gift deliveries**, filter current and saved rows together by partial gift name or outcome. Each table shows its own match count. **Clear filters** shows the full tables again. Downloads still include every current-session outcome, even when some rows are hidden by a filter.

### Rehearse the reviewed draft in the Dashboard

In the installed alpha Dashboard, load a Companion export and optional Kit Editor catalog. Select **Review engine draft**, then **Rehearse engine draft**. The results list prepared and blocked rules with reasons, and count disabled rules separately. The rehearsal uses catalog-default content packs. Use the existing PowerShell rehearsal with `--content-prefs` when you need to check custom content-pack settings.

The bundled planner uses temporary files for the rehearsal and removes them afterward. It leaves loaded rules, engine modes, and the regular Control Center installation unchanged. Selecting a different draft or catalog clears the review and rehearsal.
