# Northpath ARK relay pilot

The pilot registers one verified ARK endpoint for one designated owner. A streamer can find the server or use its ID, request access with their Specimen Implant ID, and run **Rose → 5 Stone** after approval. The website sends the test request directly to the relay, so this check can run while TikFinity and the streamer app are closed.

The relay authenticates the owner to ARK before registration. It encrypts the RCON host, port, and password with AES-256-GCM, storing the ciphertext in a private Supabase table and the key in the relay host’s secret settings. Keep a secure backup of that key for the pilot environment. The relay uses the deployment’s pinned IPv4 address and port for outbound RCON.

The owner controls an hourly limit of 1–10 rewards for the server. Live rewards and test deliveries share that limit. Each server also has a 15-second cooldown. Requests are recorded before dispatch, and the relay checks approval again immediately before sending the command. Tests that have already been dispatched may complete after revocation. An RCON acknowledgment confirms a response from ARK. Check the survivor’s inventory to confirm delivery.

## Test locally

From the Northpath checkout:

```powershell
npm ci --prefix relay
npm --prefix relay test
npm run typecheck
npm run build
```

The relay test uses the real SQL migration and a local mock RCON server.

## Set up staging

1. In the **staging Supabase** SQL Editor, run [the relay migration](../supabase/migrations/20261124000100_create_icepack_relay_pilot.sql). Use two test accounts in that project. Copy the owner account’s UUID from **Authentication → Users**.
2. Deploy the Northpath repository to a Node.js 22.12+ service with an HTTPS endpoint and a known outbound IPv4 address. Use `npm ci --prefix relay --omit=dev` to install and `npm --prefix relay start` to run. Use `GET /health` for the process health check.
3. Enter these settings in the relay host. Supply the Supabase service-role key and vault key using the host’s secret settings. The ARK password is entered later by the owner on Northpath.

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Staging Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Staging project’s legacy service_role key |
   | `ICEPACK_RELAY_SITE_ORIGIN` | Staging website origin, including HTTPS, with no path |
   | `ICEPACK_RELAY_OWNER_ID` | The staging owner account’s UUID |
   | `ICEPACK_RELAY_TARGET_HOST` | Verified RCON hostname or IPv4 address that the owner will type into the form |
   | `ICEPACK_RELAY_TARGET_IPV4` | The verified public IPv4 address of the test ARK endpoint |
   | `ICEPACK_RELAY_TARGET_PORT` | The test ARK server’s RCON port |
   | `ICEPACK_RELAY_VAULT_KEY` | A random 32-byte key encoded as 64 hex characters |
   | `PORT` | The web port supplied by the relay host, or `8787` |

   Generate the vault key locally in a private terminal:

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Use a test ARK server and dedicated test password. Allow the relay’s egress IP at the game host if the provider supports ingress restrictions. The website uses HTTPS. Standard RCON between the relay and the game host uses unencrypted TCP, so verify the connection options available from your host before using this with a production server.
5. In your staging Bolt project, use the staging Supabase URL and publishable key. Set `VITE_ICEPACK_RELAY_URL` to the relay’s HTTPS origin and build the site. Open `/companion/#connections`. The registry appears for signed-in users when that URL is configured.

## Verify with Nitrado

1. Sign in as the owner and choose **Test connection and register**. Enter the server name and RCON details supplied by the host. Choose whether the server appears in search and set a limit of one test per hour.
2. Sign in as the streamer in a separate browser profile. Find the server or enter the ID the owner provides. Request access with the test survivor’s numeric Specimen Implant ID.
3. As the owner, refresh status, verify the ID in ARK, and approve the request. As the streamer, refresh access and click **Send Rose test**. Confirm exactly five Stone in the survivor’s inventory and **ARK acknowledged** in the owner’s delivery history.
4. Revoke access as the owner. Refresh the streamer’s dashboard to see **revoked**. For a check against stale permissions, leave a second streamer tab open on the approved view and attempt the reward from that tab after revocation. Expect an approval error and no additional Stone.

## Test from TikFinity Desktop

1. In the same **Supabase → SQL Editor**, run [the Companion relay test migration](../supabase/migrations/20261125000100_create_companion_relay_tests.sql). This uses the existing website pairing. Keep the server and permissions from the earlier relay pilot.
2. In Railway, deploy the latest `development` commit to the existing relay and verify its `/health` URL returns `{"ok":true}`. In Bolt, build and publish `development` with both `VITE_SUPABASE_COMPANION_LINK_ENABLED=true` and your existing `VITE_ICEPACK_RELAY_URL`. The existing Windows pairing settings URL will include the relay address.
3. From the Northpath checkout in Windows PowerShell, build the updated streamer installer:

   ```powershell
   git switch development
   git pull --ff-only origin development
   node .\scripts\Build-IcePackPilotSetup.mjs --local --streamer
   ```

   Stop and close the previous Windows Companion, uninstall **Ice Pack Companion Streamer** from **Settings → Apps → Installed apps**, and run the new `IcePackCompanionStreamer-5.9-win-x64-Setup.exe` in `%USERPROFILE%\Downloads\IcePackCompanionStreamer`. The uninstaller preserves the existing Windows data folder.

4. Open **Ice Pack Companion Streamer** from Start and click **Start Companion**. Sign in to Northpath as the streamer. If this app needs pairing, click **Copy website pairing code** and paste it in **Companion → Connections**. The approved server and Survivor ID come from the registry. Use an approved access request for the test survivor and keep the local reward lanes off. Previous tests still count toward the owner’s hourly limit.
5. Click **Arm TikFinity test gift**. If local RCON is configured, choose **Yes** for the hosted route. Confirm the prompt shows the intended server and survivor. Within two minutes, in TikFinity Desktop use **Third-Party Action → Ice Pack Companion → Send armed test gift → Test**.
6. Verify **5 Stone** in ARK, **ARK acknowledged** in the owner's history, and the hosted acknowledgment in the Companion window. Trigger the same TikFinity action again and confirm the inventory stays the same. For the revocation check, arm a new test, revoke the streamer in the owner view, and trigger the action once. Companion should report a blocked hosted test.

A disconnect, a change to the approved survivor, or a revocation invalidates an armed test. The relay checks that the original device pairing and server approval still match before dispatch. The one-shot test credential expires after two minutes. Each hosted test uses the same owner cooldown and hourly cap as a website test.

## Set the owner reward policy

1. In the same **Supabase → SQL Editor**, run [the live Rose and whitelist migration](../supabase/migrations/20261125000200_create_companion_live_rose.sql). If you are setting up a fresh database, apply the registry and Companion relay test migrations first.
2. Deploy Railway from the latest `development` commit. Publish the current `development` build in Bolt. Keep the existing website and relay URLs.
3. Sign in as the owner and open **Companion → Connections → ARK server registry**. **All supported rewards** is the default. It enables the hosted reward catalog for approved streamers. Switch to **Owner whitelist** and select which rewards to allow, then click **Save reward policy**. A whitelist with no entries pauses hosted delivery, including the website and TikFinity tests.

To save a preset for a wipe phase, configure the reward entries in **Owner whitelist**, save the policy, and click **Export saved whitelist**. Rename the JSON file to identify the phase. To apply a different preset later, click **Import whitelist**, select the file, review the entries, and click **Save reward policy**. Importing stages the whitelist before it takes effect.

A preset that permits Stone, Wild Dodo, and the Starter Kit looks like this:

```json
{
  "version": 1,
  "allowedRewardIds": ["rose-stone", "wild-dodo", "starter-kit"]
}
```

Use an empty `allowedRewardIds` array to permit zero hosted rewards. The imported list is checked against the supported relay catalog.

## Verify the fixed live Rose rule in v5.8

1. Install **Ice Pack Companion Streamer v5.8**. Start Companion and TikFinity Desktop. Confirm the Windows app is paired to an approved streamer account and the owner’s policy allows Rose.
2. In the streamer app, click **Start Live Rewards**. If asked which route to use, choose **Yes** for the hosted route. Confirm the server and survivor are correct.
3. Send one real Rose during a TikTok LIVE. A completed Rose streak counts as one reward. Confirm the approved survivor receives **5 Stone** and the owner’s delivery history shows **Live gift · ARK acknowledged**. The hourly cap and 15-second cooldown also apply.
4. Click **Stop Live Rewards** after the test. If you want to exercise the owner control, import and save an empty whitelist before the next test. Confirm it blocks both a live Rose and a Rose test. Re-import your approved preset when ready to resume.

For a test outside a live stream, use the third-party simulator above. It uses the same owner policy and records the delivery as a test.

## Test hosted dinosaurs and Kits

1. In **Supabase → SQL Editor**, run [the hosted reward catalog migration](../supabase/migrations/20261125000300_add_hosted_reward_catalog.sql). It extends the existing registry, pairing, and live Rose migrations. Existing whitelists keep their saved Rose setting.
2. In Railway, deploy the latest `development` build to the existing relay and check that `/health` returns `{"ok":true}`. In Bolt, publish the current `development` build with your existing Supabase and relay settings.
3. On a test Nitrado server running the Ice Pack Companion ASA mod, approve the streamer’s Survivor ID. In **Companion → Connections → ARK server registry**, leave **All supported rewards** selected or explicitly allow **Wild Dodo** and **Starter Kit** in the owner's whitelist. Each consumes one delivery slot. For two tests within one hour, set a limit with enough room and wait at least 15 seconds between tests.
4. As the streamer, refresh **Your server access**, select **Wild Dodo · level 25**, and click **Send test reward**. Verify a wild level-25 Dodo spawns for the approved survivor. Then select **Starter Kit · 5 Stone + wild Dodo**, send it once, and verify both pieces in game. The owner’s history shows the reward name and the Kit step count.
5. For a wipe-phase check, export the current whitelist. Save a whitelist that includes only **Wild Dodo** and refresh the streamer view. **Starter Kit** should be unavailable. Import and save the previous file to restore your preset.

The relay checks approval and the whitelist before the Kit begins and again before its second step. If a subsequent step is interrupted, the owner’s history shows how many steps ARK acknowledged. Check the survivor in game before repeating a test.

## Use streamer Gift Rules for hosted delivery

1. In **Supabase → SQL Editor**, run [the streamer Gift Rules migration](../supabase/migrations/20261125000400_add_streamer_hosted_gift_rules.sql) after the hosted reward catalog migration above. Redeploy the current `development` build in Railway and publish the Companion website update in Bolt using the existing relay and pairing settings.
2. As the **server owner**, open **Companion → Connections → ARK server registry**. Use **All supported rewards** or save an **Owner whitelist**. The whitelist is grouped into **Items**, **Dinosaurs**, and **Kits**. The Starter Kit requires its Kit, Stone, and Wild Dodo entries to be allowed. Existing JSON preset files use the same reward IDs.
3. As the **streamer**, open **Companion → Gift rules**. Pick a gift and enter its numeric TikFinity Gift ID. Choose one of the supported hosted recipes below, enable the rule, then go to **Settings → Save to account**. Use one enabled rule per Gift ID. Rule names are for display.
4. Install **Ice Pack Companion Streamer v5.9**. Pair it to the streamer account, start TikFinity Desktop, and click **Start Live Rewards** in Companion. Select the hosted route if prompted, then confirm the approved server and Survivor ID.
5. Send the configured gift once in TikFinity’s live gift feed. Verify the expected reward in ARK and **Live gift · ARK acknowledged** in the owner’s delivery history. A completed streak counts as one reward. The server’s 15-second cooldown and hourly limit apply.

| Hosted recipe | Settings in Gift Rules or Kit Builder |
| --- | --- |
| 5 Stone, Wood, or Thatch | Select the item, quantity = 5, quality = 0 |
| Wild Dodo, Raptor, or Rex | Select the dinosaur, quantity = 1, level = 25, wild |
| Starter Kit | Create a Kit with 5 Stone at quality 0 first and one level-25 wild Dodo second. Select that Kit in the gift rule. |

Leave announcements empty for these recipes. The relay reads the streamer’s saved draft and checks the owner’s current policy at delivery. Gift IDs refresh while the paired app is online. If the draft changes mid-delivery, the relay stops before any remaining steps. The owner’s history records the delivered reward and Kit progress.

The hosted website test menu can verify the ASA mod and permissions while you are offline. Use the live gift feed to verify a streamer's Gift ID mapping.

## Test the expanded hosted catalog

1. Run [the expanded catalog migration](../supabase/migrations/20261125000500_expand_hosted_reward_catalog.sql) in Supabase after the streamer Gift Rules migration. It widens the allowed reward IDs and preserves the existing registrations, whitelists, and history.
2. Redeploy Railway from `development` and publish the updated `development` build in Bolt. Use the existing v5.9 Windows app for live Gift Rules.
3. As the owner, open **Companion → Connections → ARK server registry**. With **All supported rewards**, the new entries are available to approved streamers. With **Owner whitelist**, enable **5 Wood**, **5 Thatch**, **Wild Raptor**, or **Wild Rex** individually. Save or export a wipe-phase preset as needed.
4. As an approved streamer, refresh **Your server access** and select a new entry under **Test reward**. Use **Send test reward** and verify the resource quantity or wild level-25 spawn in ARK. The owner’s history shows the selected reward. Use a test server with the Ice Pack Companion ASA mod for the creature rewards.
5. To check live delivery, save a matching Gift Rule with its numeric TikFinity Gift ID and start hosted Live Rewards in the v5.9 app. A completed streak consumes one reward slot. The shared cooldown and hourly limit cover both the website test and live delivery.

## Test a custom hosted Kit

1. Stop hosted Live Rewards in Operations Center for the update. Run [the custom Kit migration](../supabase/migrations/20261125000600_add_custom_hosted_kits.sql) in Supabase after the expanded catalog migration. Redeploy Railway from `development`, then publish the website in Bolt. The v5.9 Windows app works with the new relay.
2. As an approved streamer, open **Companion → Kit builder** and create a Kit named **Wipe Supplies**. Add **Wood**, quantity **5**, quality **0**, then **Raptor**, quantity **1**, level **25**, with **Tamed** unchecked. Leave announcements empty, then choose **Settings → Save to account**.
3. As the server owner, keep **All supported rewards**, or choose **Owner whitelist** and enable **Custom Kits**, **5 Wood**, and **Wild Raptor**. Save the policy. The custom Kit permission is included in whitelist imports and exports. The existing Starter Kit keeps its separate permission.
4. As the streamer, open **Connections → Your server access** and click **Refresh access**. Under **Test reward**, choose **Kit: Wipe Supplies** and click **Send test reward**. Confirm you received five Wood and one wild level-25 Raptor in ARK. The owner can click **Refresh status** in the registry and check for the Kit name, its components, **Test**, and **2/2 steps acknowledged**.
5. As the owner, uncheck **Wild Raptor** and save. Refresh access on the streamer’s page and confirm the Kit is absent. Re-enable Raptor to restore the Kit. To check a live gift, assign the Kit to an enabled Gift Rule with a valid numeric TikFinity Gift ID, save to the account, and start hosted Live Rewards in v5.9. A completed gift should produce a **Live gift** history entry. The website test and live gift share the server’s cooldown and hourly limit.

Custom hosted Kits use two to four distinct catalog rewards, including at most one wild creature. The relay checks the current owner policy, player approval and saved draft before dispatch and before each remaining step. If a Kit partially completes, check its history and the game before retrying.
