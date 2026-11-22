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

## v3.5 Alpha — Side-by-side installation

The v3.4 clean install and dashboard-to-engine check passed on Windows. The v3.5 installer uses those source ZIPs to create a persistent local preview installation. Use Node.js 22.12 or newer and npm.

```powershell
node .\scripts\Install-IcePackAlpha.mjs `
  --companion "C:\path\to\companion-source.zip" --companion-sha256 "<trusted companion ZIP SHA-256>" `
  --engine "C:\path\to\engine-source.zip" --engine-sha256 "<trusted engine ZIP SHA-256>"
```

Use ZIP hashes received through a trusted channel. The installer checks both archives before extracting them, installs dependencies from both lockfiles, and builds the dashboard before publishing the new folder. Windows uses the built-in PowerShell archive cmdlet. The installer does not run the older PowerShell scripts bundled in the archive.

The default destination is `%LOCALAPPDATA%\IcePackCompanion\alpha-installs\v3.5`. Use `--install-root` to choose another parent directory. The installer stops if the version folder already exists. Installation can run alongside the existing Companion. Stop the existing services through the Control Center before launching the preview so ports 3210, 3212, and 5173 are free.

```powershell
node "$env:LOCALAPPDATA\IcePackCompanion\alpha-installs\v3.5\Install-IcePackAlpha.mjs" --start
```

Open `http://127.0.0.1:5173/` after the dashboard proxy reports the ARK Engine online. Press Ctrl+C in the launcher window to stop the three preview services. This alpha validates the installed dashboard and local service connection. Pairing, importing an existing configuration, and live game connectivity are separate milestones.
