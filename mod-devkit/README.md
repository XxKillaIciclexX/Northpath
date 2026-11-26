# ASA DevKit spawn batch 01

This batch adds wild **Parasaur**, **Triceratops**, and **Pteranodon** to the Ice Pack Companion mod. The command uses the creature token from the table, a level from 1 to 150, and the survivor’s numeric Specimen Implant ID.

| Switch case | Class picker | Expected targeted test |
| --- | --- | --- |
| `Parasaur` | `Para_Character_BP` | One wild Parasaur, level 25 |
| `Triceratops` | `Trike_Character_BP` | One wild Triceratops, level 75 |
| `Pteranodon` | `Ptero_Character_BP` | One wild Pteranodon, level 150 |

The batch uses the reviewed catalog paths for the standard versions of each creature. The DevKit play test verifies the class references on the installed game build.

## Apply the Blueprint edit

1. Open the **IcePackCompanion** mod in the Windows ARK DevKit. Open **Content → BP_IcePackCommandHandler → Event Graph**.
2. Locate the two **Switch on String** nodes with **Dodo**, **Raptor**, and **Rex** pins. To find them, search the graph for **IcePack_FindTargetSurvivor** and **IcePack_FindSingleSurvivor**. Follow the incoming execution wires from each call through the **Set Requested Dino Class** nodes to its switch. The command-name switch has pins such as **IcePackPing** and **IcePackSpawn**.
3. On the switch feeding **IcePack_FindTargetSurvivor**, add **Parasaur**, **Triceratops**, and **Pteranodon** using **Add pin** and the switch’s **Pin Names** in Details. Duplicate one of its **Set Requested Dino Class** nodes for each new case. Set the class on each new node from the table, wire its input to its switch case, and wire its execution output to the existing **IcePack_FindTargetSurvivor** call.
4. Repeat for the switch feeding **IcePack_FindSingleSurvivor**, using that switch’s existing survivor lookup as the destination. Both switch **Default** pins go to the existing unsupported-creature message. The survivor lookups feed the existing `IcePack_PerformSpawn` path, which applies the cooldown and uses the assigned class.
5. **Compile**, then **Save** the Blueprint. Start **Play** in the DevKit with one survivor. In the console run `cheat ScriptCommand IcePackListPlayers` to get that session’s numeric ID.

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
