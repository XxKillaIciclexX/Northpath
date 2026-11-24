# Northpath ARK relay pilot

The pilot registers one verified ARK endpoint for one designated owner. A streamer can find the server or use its ID, request access with their Specimen Implant ID, and run **Rose → 5 Stone** after approval. The website sends the test request directly to the relay, so this check can run while TikFinity and the streamer app are closed.

The relay authenticates the owner to ARK before registration. It encrypts the RCON host, port, and password with AES-256-GCM, storing the ciphertext in a private Supabase table and the key in the relay host’s secret settings. Keep a secure backup of that key for the pilot environment. The relay uses the deployment’s pinned IPv4 address and port for outbound RCON.

The owner controls an hourly limit of 1–10 tests for the server. Each server also has a 15-second cooldown. Requests are recorded before dispatch, and the relay checks approval again immediately before sending the command. Tests that have already been dispatched may complete after revocation. An RCON acknowledgment confirms a response from ARK. Check the survivor’s inventory to confirm delivery.

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

After the real-server test, the next milestone is routing the Windows Companion’s TikFinity simulator to the relay using its account pairing. That will let the streamer test from TikFinity with the selected server and the owner’s existing approval.
