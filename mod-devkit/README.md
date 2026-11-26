# ASA DevKit spawn batch 01

This DevKit edit replaces the two creature switches with a shared Data Table lookup. The table includes the existing **Dodo**, **Raptor**, and **Rex** and stages wild **Parasaur**, **Triceratops**, and **Pteranodon**. Each new species is a row in the table. The command uses the row name, a level from 1 to 150, and the survivor’s numeric Specimen Implant ID.

| New row name | Class picker | Expected targeted test |
| --- | --- | --- |
| `Parasaur` | `Para_Character_BP` | One wild Parasaur, level 25 |
| `Triceratops` | `Trike_Character_BP` | One wild Triceratops, level 75 |
| `Pteranodon` | `Ptero_Character_BP` | One wild Pteranodon, level 150 |

The batch uses the reviewed catalog paths for the standard versions of each creature. The DevKit play test verifies the class references on the installed game build.

## Apply the Blueprint edit

### Create and import the creature table

1. In the **IcePackCompanion** mod’s Content folder, create a Blueprint **Structure** named `ST_IcePackCreatureRow`. Add one field named `SpawnClass`. Set its type to **PrimalDinoCharacter Class Reference**, the same type as `RequestedDinoClass` in `BP_IcePackCommandHandler`. Save the structure.
2. In the same folder, import [DT_IcePackCreatures.csv](DT_IcePackCreatures.csv) as a **DataTable**, then choose `ST_IcePackCreatureRow` as the row structure. Open `DT_IcePackCreatures` and confirm six rows with a populated **SpawnClass** in each. The CSV uses generated class paths ending in `_C`. If the importer reports an empty class or a column mismatch, use the Data Table’s row editor to select each class. The source paths and class names are in the CSV.

### Wire one resolver into both paths

1. In **BP_IcePackCommandHandler**, add a Blueprint function named `IcePack_ResolveDinoClass`. Add a **String** input named `CreatureToken`. Add a **Boolean** output named `Found` and a **PrimalDinoCharacter Class Reference** output named `SpawnClass`.
2. Inside the function, connect **String to Name** on `CreatureToken` to **Get Data Table Row → Row Name** and select `DT_IcePackCreatures` on the lookup node. From **Row Found**, break the row and return its `SpawnClass` and **Found = true**. From **Row Not Found**, return **Found = false** and **SpawnClass = None**. The caller uses `Found` and a nonempty `SpawnClass` before it assigns the class.
3. In the **Event Graph**, find the two **Switch on String** nodes with **Dodo**, **Raptor**, and **Rex** pins. Trace back from **IcePack_FindTargetSurvivor** and **IcePack_FindSingleSurvivor** through their existing **Set Requested Dino Class** nodes. Replace each creature switch’s incoming execution and **Selection** wires with a call to `IcePack_ResolveDinoClass` using the same token wire.
4. On the valid output of each lookup, set `RequestedDinoClass` from the returned class and call that path’s existing survivor lookup. On the unsuccessful output, route to that path’s unsupported-creature message. The lookups feed `IcePack_PerformSpawn` to apply the existing spawn cooldown and placement. The command-name switch still dispatches commands such as `IcePackPing` and `IcePackSpawn`.
5. **Compile** and **Save** the Blueprint. Start **Play** in the DevKit with one survivor and run `cheat ScriptCommand IcePackListPlayers` for the session ID.

The initial six rows use direct class references. To expand to a much larger table, test a **Soft Class Reference** column and class loading on a cooked dedicated server first. The command should continue to receive the row token, for example `ScriptCommand IcePackSpawn,Parasaur,25,12345`.

To regenerate the CSV from [the batch list](spawn-batch-01.json) and the reviewed ARK catalog, run this from Northpath in PowerShell.

```powershell
node .\scripts\Prepare-IcePackSpawnBatch.mjs --csv |
  Set-Content -Encoding ascii .\mod-devkit\DT_IcePackCreatures.csv
```

## Verify the DevKit and server builds

From the Northpath checkout in PowerShell, run the command generator. Replace `12345` with the active survivor’s ID.

```powershell
git switch development
git pull --ff-only origin development
node .\scripts\Prepare-IcePackSpawnBatch.mjs --player-id 12345
```

- Run each targeted test separately, at least **six seconds** apart. Confirm the creature appears beside the correct survivor at the expected level. The first three commands cover Dodo, Raptor, and Rex as regression checks.
- With exactly one survivor, run the three commands that omit the ID. Confirm each new creature spawns. The unknown-species and level-151 commands should produce zero spawns. With a second survivor online, repeat a targeted test using each player’s ID and confirm each spawn goes to the selected survivor.
- Once the DevKit checks pass, cook the updated mod under the existing **CurseForge project 1814233**. Wait for the **WindowsServer** build and install the development build on the Nitrado test server. Repeat the targeted tests using the server RCON section of the command generator and that server’s survivor ID. Verify each spawn in ARK because an RCON acknowledgment only confirms receipt of the command.

Report the three targeted results, the three single-survivor results, and whether Dodo, Raptor, and Rex passed. The dedicated-server results determine which new species to enable in the Companion and hosted relay.
