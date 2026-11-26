# ASA DevKit creature Data Table

The shared creature resolver uses `DT_IcePackCreaturesSoft` for both spawn paths. The command takes a table row name, a level from 1 to 150, and the survivor’s numeric Specimen Implant ID.

## Reimport the full dashboard catalog

Use the [full soft-reference CSV](DT_IcePackCreaturesSoft.csv) with a **Soft Class Reference** field. A hard class field eagerly loads the referenced assets. A soft field stores the paths so the resolver can load the requested class when a spawn command runs. The full hard-reference reimport caused the editor to freeze. [Unreal asset reference documentation](https://dev.epicgames.com/documentation/unreal-engine/referencing-assets-in-unreal-engine)

The full CSV has **537 rows** from the dashboard’s reviewed catalog. All 537 generated class paths match the reviewed **Ark Official** ASA export. The 49 earlier inferred records now use Beacon’s paths and are marked verified in the dashboard catalog. Quetzal, Woolly Rhino, and Angler each have a second row name that resolves to the same class. [Beacon snapshot API](https://api.usebeacon.app/v4/deltas/7)

Beacon complete snapshot SHA-256 `a4f848340aa373f3f1a249d475b4f77228c0932fc4cd426c16fbc995bd519810`.

| Dashboard pack | Rows |
| --- | ---: |
| Base Game + Free Expansions | 381 |
| Astraeos | 62 |
| Bob’s Tall Tales | 6 |
| Dragontopia | 3 |
| Fantastic Tames | 5 |
| Lost Colony | 77 |
| Tides of Fortune | 3 |

1. In PowerShell, update your Northpath checkout.

   ```powershell
   git switch development
   git pull --ff-only origin development
   ```

2. Open the last working mod project. In its Content folder, create a Blueprint **Structure** named `ST_IcePackCreatureSoftRow`. Add a field named `SoftSpawnClass`. Search the type picker for **PrimalDinoCharacter** and choose its **Soft Class Reference** subtype. Save the structure.
3. Import `mod-devkit\DT_IcePackCreaturesSoft.csv` as a **new DataTable** using `ST_IcePackCreatureSoftRow`. Name the asset `DT_IcePackCreaturesSoft`. Open the table and check for **537 rows** and the **SoftSpawnClass** column. Use **Export as CSV** to save `DT_IcePackCreaturesSoft-export.csv` in your Northpath checkout. Run the comparison before starting the cook.

   ```powershell
   node .\scripts\Prepare-IcePackSpawnBatch.mjs --check-csv .\DT_IcePackCreaturesSoft-export.csv
   ```

   Expect `PASS: 537 Data Table rows match the expected generated class paths.` The audit checks the saved paths. Verify the row field’s **Soft Class Reference** type in the structure editor. In the table’s **Reference Viewer**, check that creature assets appear as soft dependencies.
4. Connect the resolver using the steps below, then start a fresh play session. Test one earlier creature such as Parasaur and the six below. Test a representative creature from each mounted DLC pack you plan to use. Use an open area for flyers and water for aquatic creatures. Verify actual species and placement in the game.
5. After the DevKit audit and play tests pass, cook one **WindowsServer** development build for CurseForge project **1814233**. Install it on the Nitrado test server and repeat the targeted command tests. Verify the creature in ARK after each RCON command.

### Load a creature on demand

Open `BP_IcePackCommandHandler → IcePack_ResolveDinoClass`. Keep the existing function pins `CreatureToken` (String), `Found` (Boolean), and `SpawnClass` (PrimalDinoCharacter Class Reference).

1. Replace the old **Get Data Table Row** node with a fresh one set to `DT_IcePackCreaturesSoft`. Connect the function’s execution input and the existing **String to Name** result as before. Right-click **Out Row** and choose **Split Struct Pin** to expose `SoftSpawnClass`.
2. Drag from `SoftSpawnClass` and add **Load Class Asset Blocking**. Wire **Row Found** to the loader’s white input and `SoftSpawnClass` to **Asset Class**.
3. Wire the loader’s white output to the success Return node. Connect the loader’s **Return Value** to the function’s `SpawnClass` output. Add **Class Is Child Of** with the loaded class as **Test Class** and **PrimalDinoCharacter** as **Parent Class**. Connect its Boolean output to `Found`. A failed load returns an empty class, so the existing caller takes the unsupported-creature path.
4. Wire **Row Not Found** to the failure Return node with `Found = false` and `SpawnClass = None`. Compile and save. Both existing caller paths can use the same function outputs.

The first spawn for a creature can pause briefly while its class and dependencies load. The blocking node lets this resolver finish inside the function before the handler starts survivor lookup. [Unreal 5.5 class loader](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/Kismet/UKismetSystemLibrary/LoadClassAsset_Blocking?application_version=5.5) · [Class validity check](https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Utilities/ClassIsChildOf)

### Six additional play tests

Generate the test commands from Northpath. Replace `12345` with the active survivor’s ID and leave at least six seconds between commands.

```powershell
node .\scripts\Prepare-IcePackSpawnBatch.mjs --batch 02 --player-id 12345
```

| Row token | Expected creature at level 25 |
| --- | --- |
| `Ankylosaurus` | Ankylosaurus |
| `Argentavis` | Argentavis |
| `Doedicurus` | Doedicurus |
| `Stegosaurus` | Stegosaurus |
| `Iguanodon` | Iguanodon |
| `Carno` | Carnotaurus |

For paid packs, use `cheat ScriptCommand IcePackSpawn,<TOKEN>,25,12345` in the DevKit console. Replace `<TOKEN>` and `12345` with the row token and survivor ID. These are representative rows to test before the same cook.

| Dashboard pack | Row token |
| --- | --- |
| Astraeos | `AstralArgentavis` |
| Bob’s Tall Tales | `Cosmo` |
| Dragontopia | `Lumina` |
| Fantastic Tames | `Pyromane` |
| Lost Colony | `Desmodus` |
| Tides of Fortune | `Parrot` |

### Export a subset

To test the free catalog independently, generate a separate file and reimport that file into the **soft-reference** table. Verify an export of that table with the matching pack flag.

```powershell
node .\scripts\Prepare-IcePackSpawnBatch.mjs --csv --pack base-game |
  Set-Content -Encoding ascii .\DT_IcePackCreaturesSoft-base-game.csv
node .\scripts\Prepare-IcePackSpawnBatch.mjs --check-csv .\DT_IcePackCreaturesSoft-export.csv --pack base-game
```

`--csv --batch 01` generates the original six rows as soft references. Use `--csv --batch 02` for the original six plus the six additional play tests. The same batch flag is available on `--check-csv`. `--csv --batch 01 --hard-class` generates the CSV for the original hard-reference table.

## Original six-row hard-reference setup

| Batch 01 row name | Class picker | Expected targeted test |
| --- | --- | --- |
| `Parasaur` | `Para_Character_BP` | One wild Parasaur, level 25 |
| `Triceratops` | `Trike_Character_BP` | One wild Triceratops, level 75 |
| `Pteranodon` | `Ptero_Character_BP` | One wild Pteranodon, level 150 |

The batch uses the reviewed catalog paths for the standard versions of each creature. The DevKit play test verifies the class references on the installed game build.

## Apply the Blueprint edit

### Create and import the creature table

1. In the **IcePackCompanion** mod’s Content folder, create a Blueprint **Structure** named `ST_IcePackCreatureRow`. Add one field named `SpawnClass`. Set its type to **PrimalDinoCharacter Class Reference**, the same type as `RequestedDinoClass` in `BP_IcePackCommandHandler`. Save the structure.
2. In the same folder, import [DT_IcePackCreatures.csv](DT_IcePackCreatures.csv) as a **DataTable**, then choose `ST_IcePackCreatureRow` as the row structure. Open `DT_IcePackCreatures` and confirm every row has a populated **SpawnClass**. The CSV uses generated class paths ending in `_C`. The audit above lists references to correct if the importer reports an empty class.

### Wire one resolver into both paths

1. In **BP_IcePackCommandHandler**, add a Blueprint function named `IcePack_ResolveDinoClass`. Add a **String** input named `CreatureToken`. Add a **Boolean** output named `Found` and a **PrimalDinoCharacter Class Reference** output named `SpawnClass`.
2. Inside the function, connect **String to Name** on `CreatureToken` to **Get Data Table Row → Row Name** and select `DT_IcePackCreatures` on the lookup node. Right-click **Out Row** and choose **Split Struct Pin** to expose `SpawnClass`. From **Row Found**, return its `SpawnClass` and **Found = true**. From **Row Not Found**, return **Found = false** and **SpawnClass = None**. The caller uses `Found` and a nonempty `SpawnClass` before it assigns the class.
3. In the **Event Graph**, find the two **Switch on String** nodes with **Dodo**, **Raptor**, and **Rex** pins. Trace back from **IcePack_FindTargetSurvivor** and **IcePack_FindSingleSurvivor** through their existing **Set Requested Dino Class** nodes. Replace each creature switch’s incoming execution and **Selection** wires with a call to `IcePack_ResolveDinoClass` using the same token wire.
4. On the valid output of each lookup, set `RequestedDinoClass` from the returned class and call that path’s existing survivor lookup. On the unsuccessful output, route to that path’s unsupported-creature message. The lookups feed `IcePack_PerformSpawn` to apply the existing spawn cooldown and placement. The command-name switch still dispatches commands such as `IcePackPing` and `IcePackSpawn`.
5. **Compile** and **Save** the Blueprint. Start **Play** in the DevKit with one survivor and run `cheat ScriptCommand IcePackListPlayers` for the session ID.

To regenerate the full soft-reference CSV from the [reviewed dashboard catalog](../companion/src/reviewed-catalog.json), run this from Northpath in PowerShell.

```powershell
node .\scripts\Prepare-IcePackSpawnBatch.mjs --csv |
  Set-Content -Encoding ascii .\mod-devkit\DT_IcePackCreaturesSoft.csv
```

## Verify the DevKit and server builds

For the original **batch 01** regression tests, run the command generator. Replace `12345` with the active survivor’s ID.

```powershell
git switch development
git pull --ff-only origin development
node .\scripts\Prepare-IcePackSpawnBatch.mjs --player-id 12345
```

- Run each targeted test separately, at least **six seconds** apart. Confirm the creature appears beside the correct survivor at the expected level. The first three commands cover Dodo, Raptor, and Rex as regression checks.
- With exactly one survivor, run the three commands that omit the ID. Confirm each new creature spawns. The unknown-species and level-151 commands should produce zero spawns. With a second survivor online, repeat a targeted test using each player’s ID and confirm each spawn goes to the selected survivor.
- Once the DevKit checks pass, cook the updated mod under the existing **CurseForge project 1814233**. Wait for the **WindowsServer** build and install the development build on the Nitrado test server. Repeat the targeted tests using the server RCON section of the command generator and that server’s survivor ID. Verify each spawn in ARK because an RCON acknowledgment only confirms receipt of the command.

Report the three targeted results, the three single-survivor results, and whether Dodo, Raptor, and Rex passed. The dedicated-server results determine which new species to enable in the Companion and hosted relay.
