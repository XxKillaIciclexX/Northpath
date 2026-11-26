begin;

-- The verified, enabled base-game items from companion/src/reviewed-catalog.json.
-- relay/pilot.test.mjs checks the exact same IDs against the relay catalog.
create function public.icepack_hosted_item_ids()
returns text[] language sql immutable set search_path = '' as $$
    select array[
        'rose-stone', 'wood-5', 'thatch-5', 'item:AbsorbentSubstrate', 'item:AchatinaPaste', 'item:AcroAdrenalGland',
        'item:AcroSaddle', 'item:AcrocanthosaurusEgg', 'item:AdobeBehemothCellarDoor', 'item:AdobeBehemothGate', 'item:AdobeBehemothGateway', 'item:AdobeCeilingHatchframe',
        'item:AdobeDoorsWindows', 'item:AdobeFenceFoundationSupport', 'item:AdobeFoundation', 'item:AdobeGate', 'item:AdobeGateway', 'item:AdobeLadder',
        'item:AdobeLargeCellarDoor', 'item:AdobeLargeWall', 'item:AdobePillar', 'item:AdobeQuarterTriangleCeiling', 'item:AdobeQuarterWallRailing', 'item:AdobeRoofRampStairs',
        'item:AdobeSlopedWall', 'item:AdobeTriangleQuarterFoundation', 'item:AdobeTriangleRoofCorner', 'item:AdobeWallDoorwaysWindowframe', 'item:AdvancedBullet', 'item:AdvancedRifleBullet',
        'item:AdvancedSniperBullet', 'item:AggeravicMushroom', 'item:AirConditioner', 'item:AlasieARKTheAnimatedSeriesCostumeSkinDearJane', 'item:AlgaeSushi', 'item:AllosaurusBrain',
        'item:AllosaurusEgg', 'item:AllosaurusSaddle', 'item:AlphaBasiliskFang', 'item:AlphaBroodmotherTrophy', 'item:AlphaCarnotaurusArm', 'item:AlphaDeathwormTrophy',
        'item:AlphaDragonTrophy', 'item:AlphaGrendelTrophy', 'item:AlphaKarkinosClaw', 'item:AlphaLeedsichthysBlubber', 'item:AlphaManticoreTrophy', 'item:AlphaMegalodonFin',
        'item:AlphaMegapithecusTrophy', 'item:AlphaMosasaurTooth', 'item:AlphaNunatakTrophy', 'item:AlphaRaptorClaw', 'item:AlphaReaperKingBarb', 'item:AlphaRexTrophy',
        'item:AlphaTusoteuthisEye', 'item:AlphaTyrannosaurTooth', 'item:AlphaWyvernTrophy', 'item:Amarberry', 'item:AmarberrySeed', 'item:Ambergris',
        'item:AmmoBox', 'item:AmmoniteBile', 'item:AnglerGel', 'item:AnkyloEgg', 'item:AnkylosaurusARKTheAnimatedSeriesCostumeDearJane', 'item:AnkylosaurusSaddle',
        'item:AnniversaryCandy', 'item:AnyAlphaTribute', 'item:ApexOffering', 'item:AquamarineColoring', 'item:AquaticCompartment', 'item:AquaticMushroom',
        'item:AraneoSaddle', 'item:ArchaeopteryxEgg', 'item:ArchelonAlgae', 'item:ArchelonEgg', 'item:ArchelonSaddle', 'item:ArgentavisARKTheAnimatedSeriesCostumeDearJane',
        'item:ArgentavisEgg', 'item:ArgentavisSaddle', 'item:ArgentavisTalon', 'item:ArthroplueraEgg', 'item:ArthroplueraSaddle', 'item:ArtifactPedestal',
        'item:ArtifactofChaos', 'item:ArtifactofGrowth', 'item:ArtifactoftheBrute', 'item:ArtifactoftheClever', 'item:ArtifactoftheCrag', 'item:ArtifactoftheCunning',
        'item:ArtifactoftheDepths', 'item:ArtifactoftheDestroyer', 'item:ArtifactoftheDevious', 'item:ArtifactoftheDevourer', 'item:ArtifactoftheGatekeeper', 'item:ArtifactoftheHunter',
        'item:ArtifactoftheImmune', 'item:ArtifactoftheLost', 'item:ArtifactoftheMassive', 'item:ArtifactofthePack', 'item:ArtifactoftheShadows', 'item:ArtifactoftheSkylord',
        'item:ArtifactoftheStalker', 'item:ArtifactoftheStrong', 'item:ArtifactoftheVoid', 'item:AscensionCaveEasyTribute', 'item:AscensionCaveHardTribute', 'item:AscensionCaveMediumTribute',
        'item:AscerbicMushroom', 'item:AssaultRifle', 'item:AstrocetusTekSaddle', 'item:AuricMushroom', 'item:AutoTurret', 'item:AvocadoColoring',
        'item:Azulberry', 'item:AzulberrySeed', 'item:AzureColoring', 'item:BabyblueColoring', 'item:BallistaTurret', 'item:BarkColoring',
        'item:BaryonyxEgg', 'item:BaryonyxSaddle', 'item:BasicFertilizedMaeguanaEgg', 'item:BasicKibble', 'item:BasicMaeguanaEgg', 'item:BasiliskEgg',
        'item:BasiliskSaddle', 'item:BasiliskScale', 'item:BasilosaurusBlubber', 'item:BasilosaurusSaddle', 'item:BattleTartare', 'item:BearTrap',
        'item:BeeHive', 'item:BeelzebufoSaddle', 'item:BeerBarrel', 'item:BeerJar', 'item:BetaBroodmotherTrophy', 'item:BetaDragonTrophy',
        'item:BetaGrendelTrophy', 'item:BetaManticoreTrophy', 'item:BetaMegapithecusTrophy', 'item:BetaNunatakTrophy', 'item:BioToxin', 'item:BisonMilk',
        'item:BisonSaddle', 'item:BlackColoring', 'item:BlackPearl', 'item:BloodExtractionSyringe', 'item:BloodPack', 'item:BlueColoring',
        'item:BlueCrystalizedSap', 'item:BlueGem', 'item:BobARKTheAnimatedSeriesCostumeSkinDearJane', 'item:Bola', 'item:Boomerang', 'item:Boulder',
        'item:Bow', 'item:BreedingCakeSlice', 'item:BrickColoring', 'item:BrontoARKTheAnimatedSeriesCostumeDearJane', 'item:BrontoEgg', 'item:BrontoPlatformSaddle',
        'item:BrontoSaddle', 'item:BronzeColoring', 'item:BroodmotherEasyTribute', 'item:BroodmotherHardTribute', 'item:BroodmotherMediumTribute', 'item:BroodmotherTrophy',
        'item:BrothofEnlightenment', 'item:BrownColoring', 'item:BruiseColoring', 'item:BubblegumColoring', 'item:BugRepellant', 'item:BunkBed',
        'item:BunnyEarsSkin', 'item:BurnColoring', 'item:ButtermilkColoring', 'item:C4Charge', 'item:C4RemoteDetonator', 'item:CactusBroth',
        'item:CactusSap', 'item:CalienSoup', 'item:CamelColoring', 'item:Camera', 'item:Campfire', 'item:CanaryColoring',
        'item:Cannon', 'item:CannonBall', 'item:CannonShell', 'item:CantaloupeColoring', 'item:Canteen', 'item:CanteenFilled',
        'item:CarbonemysEgg', 'item:CarbonemysSaddle', 'item:CarcharoSaddle', 'item:CarcharodontosaurusEgg', 'item:CarnoEgg', 'item:CarnoSaddle',
        'item:CastoroidesSaddle', 'item:CatapultTurret', 'item:CeladonColoring', 'item:CelesteColoring', 'item:CementingPaste', 'item:CeratoVenomSpine',
        'item:CeratosaurusEgg', 'item:CeratosaurusSaddle', 'item:CeteceanColoring', 'item:ChainBola', 'item:Chainsaw', 'item:ChalicotheriumSaddle',
        'item:Charcoal', 'item:CharcoalColoring', 'item:ChargeBattery', 'item:ChargeLantern', 'item:ChartreuseColoring', 'item:ChateauColoring',
        'item:ChemistryBench', 'item:ChibiAchatina', 'item:ChibiAllosaurus', 'item:ChibiAmmonite', 'item:ChibiAnglerfish', 'item:ChibiAnkylosaurus',
        'item:ChibiAraneo', 'item:ChibiArchaeopteryx', 'item:ChibiArgentavis', 'item:ChibiBaryonyx', 'item:ChibiBasilisk', 'item:ChibiBeelzebufo',
        'item:ChibiBrontosaurus', 'item:ChibiBroodmother', 'item:ChibiBulbdog', 'item:ChibiCarbonemys', 'item:ChibiCarcharodontosaurus', 'item:ChibiCarnotaurus',
        'item:ChibiCastoroides', 'item:ChibiCnidaria', 'item:ChibiDaeodon', 'item:ChibiDilophosaur', 'item:ChibiDiplodocus', 'item:ChibiDirebear',
        'item:ChibiDirewolf', 'item:ChibiDodo', 'item:ChibiDoedicurus', 'item:ChibiDunkleosteus', 'item:ChibiEnforcer', 'item:ChibiEquus',
        'item:ChibiFeatherlight', 'item:ChibiFireWyvern', 'item:ChibiGacha', 'item:ChibiGallimimus', 'item:ChibiGasbags', 'item:ChibiGiganotosaurus',
        'item:ChibiGigantopithecus', 'item:ChibiGlowtail', 'item:ChibiIquanodon', 'item:ChibiJerboa', 'item:ChibiKairuku', 'item:ChibiKaprosuchus',
        'item:ChibiKarkinos', 'item:ChibiKentrosaurus', 'item:ChibiLightningWyvern', 'item:ChibiLovebird', 'item:ChibiLymantria', 'item:ChibiMammoth',
        'item:ChibiManagarmr', 'item:ChibiManta', 'item:ChibiMantis', 'item:ChibiMegalania', 'item:ChibiMegaloceros', 'item:ChibiMegalodon',
        'item:ChibiMegatherium', 'item:ChibiMesopithecus', 'item:ChibiMicroraptor', 'item:ChibiMosasaurus', 'item:ChibiMoschops', 'item:ChibiOnyc',
        'item:ChibiOtter', 'item:ChibiOviraptor', 'item:ChibiOvis', 'item:ChibiPachy', 'item:ChibiParaceratherium', 'item:ChibiParasaurolophus',
        'item:ChibiPelagornis', 'item:ChibiPhiomia', 'item:ChibiPhoenix', 'item:ChibiPlesiosaur', 'item:ChibiPoisonWyvern', 'item:ChibiProcoptodon',
        'item:ChibiPteranodon', 'item:ChibiPulmonoscorpius', 'item:ChibiPurlovia', 'item:ChibiQueenBee', 'item:ChibiQuetzalcoatlus', 'item:ChibiRaptor',
        'item:ChibiReaper', 'item:ChibiRex', 'item:ChibiRockDrake', 'item:ChibiRockGolem', 'item:ChibiRollRat', 'item:ChibiSabertooth',
        'item:ChibiSarco', 'item:ChibiSeeker', 'item:ChibiShinehorn', 'item:ChibiSnowOwl', 'item:ChibiSpinosaurus', 'item:ChibiStegosaurus',
        'item:ChibiTapejara', 'item:ChibiTekRaptor', 'item:ChibiTerrorBird', 'item:ChibiTherizinosaurus', 'item:ChibiThornyDragon', 'item:ChibiThylacoleo',
        'item:ChibiTitanosaur', 'item:ChibiTriceratops', 'item:ChibiTroodon', 'item:ChibiTusoteuthis', 'item:ChibiUnicorn', 'item:ChibiVelonasaur',
        'item:ChibiVulture', 'item:ChibiWoollyRhino', 'item:ChibiYutyrannus', 'item:Chitin', 'item:ChitinBoots', 'item:ChitinChestpiece',
        'item:ChitinGauntlets', 'item:ChitinHelmet', 'item:ChitinLeggings', 'item:Cianberry', 'item:CianberrySeed', 'item:CitronColoring',
        'item:Citronal', 'item:CitronalSeed', 'item:Clay', 'item:ClimbingPick', 'item:ClothBoots', 'item:ClothGloves',
        'item:ClothHat', 'item:ClothPants', 'item:ClothShirt', 'item:ClownMask', 'item:ClusterGrenade', 'item:CobaltColoring',
        'item:CommonChibiCrate', 'item:CommonMushroom', 'item:CompostBin', 'item:CompoundBow', 'item:CompyEgg', 'item:ConcaSaddle',
        'item:ConcavenatorEgg', 'item:CondensedGas', 'item:CongealedGasBall', 'item:CookedFishMeat', 'item:CookedLambChop', 'item:CookedMeat',
        'item:CookedMeatJerky', 'item:CookedPrimeFishMeat', 'item:CookedPrimeMeat', 'item:CookingPot', 'item:CornflowerColoring', 'item:CorruptHeart',
        'item:CorruptedNodule', 'item:CorruptedWood', 'item:CottonCandyColoring', 'item:CraftedElementDustElement', 'item:CraftedElementDustShards', 'item:CraggyDewColoring',
        'item:CreamColoring', 'item:Crossbow', 'item:CruiseMissile', 'item:Cryofridge', 'item:CryolophosaurusEgg', 'item:CryolophosaurusSaddle',
        'item:Crystal', 'item:CrystalColoring', 'item:CustomRecipeCake', 'item:CustomRecipeDrink', 'item:CustomRecipeFancyFood', 'item:CustomRecipeFizzyDrink',
        'item:CustomRecipeSandwich', 'item:CyanColoring', 'item:DaeodonARKTheAnimatedSeriesCostumeDearJane', 'item:DaeodonSaddle', 'item:DeathwormHorn', 'item:DecorBox',
        'item:DecorativeRavagerSaddle', 'item:DeepfreezeColoring', 'item:DeinonychusEgg', 'item:DeinonychusSaddle', 'item:DeinosuchusEgg', 'item:DeinosuchusSaddle',
        'item:DeinotheriumSaddle', 'item:DeliveryCrate', 'item:DenimColoring', 'item:DesertClothBoots', 'item:DesertClothGloves', 'item:DesertClothPants',
        'item:DesertClothShirt', 'item:DesertGhillieBootsSkin', 'item:DesertGhillieChestpieceSkin', 'item:DesertGhillieGauntletsSkin', 'item:DesertGhillieLeggingsSkin', 'item:DesertGhillieMaskSkin',
        'item:DesertGogglesandHat', 'item:DesertTitanTrophy', 'item:DiloEgg', 'item:DimetrodonEgg', 'item:DimorphEgg', 'item:DinoBunnyEarsSkin',
        'item:DinoLeash', 'item:DinoWitchHatSkin', 'item:DiploEgg', 'item:DiplodocusSaddle', 'item:DirebearSaddle', 'item:DirtColoring',
        'item:DisplayCase', 'item:DodoARKTheAnimatedSeriesCostumeDearJane', 'item:DodoEgg', 'item:DoedicurusARKTheAnimatedSeriesCostumeDearJane', 'item:DoedicurusSaddle', 'item:DrabColoring',
        'item:DragonEasyTribute', 'item:DragonFlag', 'item:DragonHardTribute', 'item:DragonMediumTribute', 'item:DragonTrophy', 'item:DreadnoughtusEgg',
        'item:DreadnoughtusPlatformSaddle', 'item:DunkleosteusSaddle', 'item:DuskColoring', 'item:EXPCakeSlice', 'item:EdmundRockwellARKTheAnimatedSeriesCostumeSkinDearJane', 'item:EdochaColoring',
        'item:EggIncubator', 'item:EggplantColoring', 'item:ElectricProd', 'item:ElectricalGenerator', 'item:ElectricityColoring', 'item:Electronics',
        'item:Element', 'item:ElementDust', 'item:ElementOre', 'item:ElementShard', 'item:ElementfromPowerNode', 'item:ElevatorTrack',
        'item:EmeraldColoring', 'item:EminenceColoring', 'item:EmptyCryopod', 'item:EnduroStew', 'item:EnergyBrew', 'item:EquusSaddle',
        'item:ExceptionalFertilizedMaeguanaEgg', 'item:ExceptionalKibble', 'item:ExceptionalMaeguanaEgg', 'item:ExtraordinaryFertilizedMaeguanaEgg', 'item:ExtraordinaryKibble', 'item:ExtraordinaryMaeguanaEgg',
        'item:FabricatedPistol', 'item:FabricatedSniperRifle', 'item:Fabricator', 'item:FasolasuchusEgg', 'item:FasolasuchusSaddle', 'item:FeatherlightEgg',
        'item:FeedingTrough', 'item:FertilizedAberrantAnglerEgg', 'item:FertilizedAberrantAnkyloEgg', 'item:FertilizedAberrantAraneoEgg', 'item:FertilizedAberrantArthroplueraEgg', 'item:FertilizedAberrantBaryonyxEgg',
        'item:FertilizedAberrantBeelzebufoEgg', 'item:FertilizedAberrantCarnoEgg', 'item:FertilizedAberrantConcavenatorEgg', 'item:FertilizedAberrantDimetrodonEgg', 'item:FertilizedAberrantDiploEgg', 'item:FertilizedAberrantDiplocaulusEgg',
        'item:FertilizedAberrantDodoEgg', 'item:FertilizedAberrantEelEgg', 'item:FertilizedAberrantFasolasuchusEgg', 'item:FertilizedAberrantGigantoraptorEgg', 'item:FertilizedAberrantIguanodonEgg', 'item:FertilizedAberrantLystrosaurusEgg',
        'item:FertilizedAberrantMegalaniaEgg', 'item:FertilizedAberrantMegalosaurusEgg', 'item:FertilizedAberrantMoschopsEgg', 'item:FertilizedAberrantOviraptorEgg', 'item:FertilizedAberrantParasaurEgg', 'item:FertilizedAberrantPulmonoscorpiusEgg',
        'item:FertilizedAberrantRaptorEgg', 'item:FertilizedAberrantSarcoEgg', 'item:FertilizedAberrantSpinoEgg', 'item:FertilizedAberrantStegoEgg', 'item:FertilizedAberrantTrikeEgg', 'item:FertilizedAberrantTurtleEgg',
        'item:FertilizedAcrocanthosaurusEgg', 'item:FertilizedAllosaurusEgg', 'item:FertilizedAnglerEgg', 'item:FertilizedAnkyloEgg', 'item:FertilizedAraneoEgg', 'item:FertilizedArchaeopteryxEgg',
        'item:FertilizedArchelonEgg', 'item:FertilizedArgentavisEgg', 'item:FertilizedArthroplueraEgg', 'item:FertilizedBaryonyxEgg', 'item:FertilizedBasiliskEgg', 'item:FertilizedBeelzebufoEgg',
        'item:FertilizedBloodstalkerEgg', 'item:FertilizedBrontoEgg', 'item:FertilizedCarbonemysEgg', 'item:FertilizedCarcharodontosaurusEgg', 'item:FertilizedCarnoEgg', 'item:FertilizedCeratosaurusEgg',
        'item:FertilizedCompyEgg', 'item:FertilizedConcavenatorEgg', 'item:FertilizedCryolophosaurusEgg', 'item:FertilizedDeinonychusEgg', 'item:FertilizedDeinosuchusEgg', 'item:FertilizedDiloEgg',
        'item:FertilizedDimetrodonEgg', 'item:FertilizedDimorphEgg', 'item:FertilizedDiploEgg', 'item:FertilizedDiplocaulusEgg', 'item:FertilizedDodoEgg', 'item:FertilizedDreadnoughtusEgg',
        'item:FertilizedElectrophorusEgg', 'item:FertilizedFasolasuchusEgg', 'item:FertilizedFeatherlightEgg', 'item:FertilizedFireWyvernEgg', 'item:FertilizedGallimimusEgg', 'item:FertilizedGiganotosaurusEgg',
        'item:FertilizedGigantoraptorEgg', 'item:FertilizedGlowtailEgg', 'item:FertilizedGriffinEgg', 'item:FertilizedHelicoprionEgg', 'item:FertilizedHesperornisEgg', 'item:FertilizedIceWyvernEgg',
        'item:FertilizedIchthyornisEgg', 'item:FertilizedIguanodonEgg', 'item:FertilizedKairukuEgg', 'item:FertilizedKaprosuchusEgg', 'item:FertilizedKentroEgg', 'item:FertilizedLightningWyvernEgg',
        'item:FertilizedLymantriaEgg', 'item:FertilizedLystrosaurusEgg', 'item:FertilizedMagmasaurEgg', 'item:FertilizedMantisEgg', 'item:FertilizedMegachelonEgg', 'item:FertilizedMegalaniaEgg',
        'item:FertilizedMegalosaurusEgg', 'item:FertilizedMegaraptorEgg', 'item:FertilizedMicroraptorEgg', 'item:FertilizedMorellatopsEgg', 'item:FertilizedMoschopsEgg', 'item:FertilizedOviraptorEgg',
        'item:FertilizedPachycephalosaurusEgg', 'item:FertilizedPachyrhinoEgg', 'item:FertilizedPalaeoctopusEgg', 'item:FertilizedParasaurEgg', 'item:FertilizedPegomastaxEgg', 'item:FertilizedPelagornisEgg',
        'item:FertilizedPhoenixEgg', 'item:FertilizedPoisonWyvernEgg', 'item:FertilizedPteranodonEgg', 'item:FertilizedPulmonoscorpiusEgg', 'item:FertilizedQuetzalEgg', 'item:FertilizedRaptorEgg',
        'item:FertilizedRexEgg', 'item:FertilizedRockDrakeEgg', 'item:FertilizedSarcoEgg', 'item:FertilizedSnowOwlEgg', 'item:FertilizedSpinoEgg', 'item:FertilizedStegoEgg',
        'item:FertilizedTapejaraEgg', 'item:FertilizedTekGiganotosaurusEgg', 'item:FertilizedTekParasaurEgg', 'item:FertilizedTekQuetzalEgg', 'item:FertilizedTekRaptorEgg', 'item:FertilizedTekRexEgg',
        'item:FertilizedTekStegoEgg', 'item:FertilizedTekTrikeEgg', 'item:FertilizedTerrorBirdEgg', 'item:FertilizedTherizinoEgg', 'item:FertilizedThornyDragonEgg', 'item:FertilizedTrikeEgg',
        'item:FertilizedTroodonEgg', 'item:FertilizedTusoteuthisEgg', 'item:FertilizedVelonasaurEgg', 'item:FertilizedVultureEgg', 'item:FertilizedXAcrocanthosaurusEgg', 'item:FertilizedXAllosaurusEgg',
        'item:FertilizedXAnkyloEgg', 'item:FertilizedXArchelonEgg', 'item:FertilizedXArgentavisEgg', 'item:FertilizedXConcavenatorEgg', 'item:FertilizedXCryolophosaurusEgg', 'item:FertilizedXDeinosuchusEgg',
        'item:FertilizedXHelicoprionEgg', 'item:FertilizedXParasaurEgg', 'item:FertilizedXRaptorEgg', 'item:FertilizedXRexEgg', 'item:FertilizedXSpinoEgg', 'item:FertilizedXTapejaraEgg',
        'item:FertilizedXTrikeEgg', 'item:FertilizedXXiphactinusEgg', 'item:FertilizedXYutyrannusEgg', 'item:FertilizedXiphactinusEgg', 'item:FertilizedYiLingEgg', 'item:FertilizedYutyrannusEgg',
        'item:Fertilizer', 'item:FilthColoring', 'item:FireTalon', 'item:FireworksRocketLauncher', 'item:FishBasket', 'item:FishNet',
        'item:FishingRod', 'item:FlakBoots', 'item:FlakChestpiece', 'item:FlakGauntlets', 'item:FlakHelmet', 'item:FlakLeggings',
        'item:FlameArrow', 'item:Flamethrower', 'item:FlamethrowerAmmo', 'item:FlamingLargeAnimalFeces', 'item:FlamingMediumAnimalFeces', 'item:FlamingoColoring',
        'item:FlareGun', 'item:FlashlightAttachment', 'item:Flint', 'item:FocalChili', 'item:ForestColoring', 'item:ForestTitanTrophy',
        'item:FragmentedGreenGem', 'item:FriaCurry', 'item:FrostColoring', 'item:FungalWood', 'item:FurBoots', 'item:FurCap',
        'item:FurChestpiece', 'item:FurGauntlets', 'item:FurLeggings', 'item:FuschiaColoring', 'item:GachaSaddle', 'item:GaiusMarcellusNervaARKTheAnimatedSeriesCostumeSkinDearJane',
        'item:GallimimusEgg', 'item:GallimimusSaddle', 'item:GammaBroodmotherTrophy', 'item:GammaDragonTrophy', 'item:GammaGrendelTrophy', 'item:GammaManticoreTrophy',
        'item:GammaMegapithecusTrophy', 'item:GammaNunatakTrophy', 'item:GasCollector', 'item:GasMask', 'item:GasbagsSaddle', 'item:Gasbagsbladder',
        'item:Gasoline', 'item:GasolinefromGasBalls', 'item:GenerateGrendelAlphaPortal', 'item:GenerateGrendelBetaPortal', 'item:GenerateGrendelGammaPortal', 'item:GhillieBoots',
        'item:GhillieChestpiece', 'item:GhillieGauntlets', 'item:GhillieLeggings', 'item:GhillieMask', 'item:GiganotosaurusARKTheAnimatedSeriesCostumeDearJane', 'item:GiganotosaurusEgg',
        'item:GiganotosaurusHeart', 'item:GiganotosaurusSaddle', 'item:GigantoraptorEgg', 'item:GigantoraptorFeather', 'item:GigantoraptorSaddle', 'item:GladiatrixARKTheAnimatedSeriesCostumeSkinDearJane',
        'item:GliderSuit', 'item:GlowStick', 'item:GlowtailEgg', 'item:GoldColoring', 'item:GoldenEgg', 'item:GoreColoring',
        'item:GorillaFlag', 'item:GrapplingHook', 'item:GrassColoring', 'item:Gravestone', 'item:GreenColoring', 'item:GreenGem',
        'item:GreenhouseCeiling', 'item:GreenhouseDoorsWindows', 'item:GreenhouseRoof', 'item:GreenhouseSlopedWall', 'item:GreenhouseTriangleCeiling', 'item:GreenhouseTriangleRoofCorner',
        'item:GreenhouseWallDoorways', 'item:Grenade', 'item:GrendelFlag', 'item:GreyColoring', 'item:GriffinEgg', 'item:GunmetalColoring',
        'item:Gunpowder', 'item:Hairball', 'item:Handcuffs', 'item:HarpoonGun', 'item:HarvestCakeSlice', 'item:HazardSuitBoots',
        'item:HazardSuitGloves', 'item:HazardSuitHat', 'item:HazardSuitPants', 'item:HazardSuitShirt', 'item:HazeColoring', 'item:HeavyMinersHelmet',
        'item:HeavyTurret', 'item:HelenaWalkerARKTheAnimatedSeriesCostumeSkinDearJane', 'item:HelicoprionSaddle', 'item:HemoglobinCocktail', 'item:HenryTownsendARKTheAnimatedSeriesCostumeSkinDearJane', 'item:HesperonisEgg',
        'item:Hide', 'item:HideBoots', 'item:HideGloves', 'item:HideHat', 'item:HidePants', 'item:HideShirt',
        'item:HideSleepingBag', 'item:HoloScopeAttachment', 'item:HomingUnderwaterMine', 'item:Honey', 'item:HumanFeces', 'item:HumanHair',
        'item:HunterColoring', 'item:HyaenodonMeatpack', 'item:IceColoring', 'item:IceTitanTrophy', 'item:IcedCanteen', 'item:IcedCanteenFilled',
        'item:IcedWaterJar', 'item:IcedWaterJarFilled', 'item:IcewormQueenTrophy', 'item:IchthyornisEgg', 'item:IchthyosaurusSaddle', 'item:IguanodonEgg',
        'item:IguanodonSaddle', 'item:ImprintCakeSlice', 'item:ImprovisedExplosiveDevice', 'item:IncenseColoring', 'item:IndigoColoring', 'item:IndustrialCooker',
        'item:IndustrialForge', 'item:IndustrialGrill', 'item:IndustrialGrinder', 'item:JohnARKTheAnimatedSeriesCostumeSkinDearJane', 'item:JungleColoring', 'item:KairukuEgg',
        'item:KaprosuchusEgg', 'item:KaprosuchusSaddle', 'item:KarkinosSaddle', 'item:KentrosaurusEgg', 'item:Keratin', 'item:KhakiColoring',
        'item:KingTitanFlag', 'item:KingTitanTrophyAlpha', 'item:KingTitanTrophyBeta', 'item:KingTitanTrophyGamma', 'item:KobiColoring', 'item:KortheProphetARKTheAnimatedSeriesCostumeSkinDearJane',
        'item:LagoonColoring', 'item:Lamppost', 'item:Lance', 'item:LargeAnimalFeces', 'item:LargeBearTrap', 'item:LargeCropPlot',
        'item:LargeElevatorPlatform', 'item:LargeStorageBoxBookshelf', 'item:LargeTekTeleporter', 'item:LargeWoodElevatorPlatform', 'item:LaserAttachment', 'item:Lasso',
        'item:LatteColoring', 'item:LavenderColoring', 'item:LazarusChowder', 'item:LeatherColoring', 'item:LeechBlood', 'item:LegendaryChibiCrate',
        'item:LesserAntidote', 'item:LightningTalon', 'item:LilacColoring', 'item:LittleRatfishTreats', 'item:LongneckRifle', 'item:Longrass',
        'item:LongrassSeed', 'item:LustColoring', 'item:LymantriaEgg', 'item:LymantriaSaddle', 'item:LystroEgg', 'item:MDSM',
        'item:MOMI', 'item:MRLM', 'item:MSCM', 'item:MaeguanaSaddle', 'item:Magenberry', 'item:MagenberrySeed',
        'item:MagentaColoring', 'item:MagmasaurSaddle', 'item:MagnifyingGlass', 'item:MammothSaddle', 'item:ManagarmrSaddle', 'item:MantaSaddle',
        'item:ManticoreFlag', 'item:ManticoreShieldSkin', 'item:ManticoreTrophy', 'item:MantisEgg', 'item:MantisSaddle', 'item:MarianaColoring',
        'item:MarineColoring', 'item:MassiveAnimalFeces', 'item:MasterControllerHelmet', 'item:MasterControllerTrophy', 'item:MauveColoring', 'item:MedicalBrew',
        'item:MediumAnimalFeces', 'item:MediumCropPlot', 'item:MediumElevatorPlatform', 'item:MediumTekTeleporter', 'item:MediumWoodElevatorPlatform', 'item:MegachelonEgg',
        'item:MegachelonPlatformSaddle', 'item:MegalaniaARKTheAnimatedSeriesCostumeDearJane', 'item:MegalaniaEgg', 'item:MegalaniaSaddle', 'item:MegalaniaToxin', 'item:MegalocerosSaddle',
        'item:MegalodonSaddle', 'item:MegalodonTooth', 'item:MegalosaurusEgg', 'item:MegalosaurusSaddle', 'item:MegapithecusEasyTribute', 'item:MegapithecusHardTribute',
        'item:MegapithecusMediumTribute', 'item:MegapithecusTrophy', 'item:MegaraptorEgg', 'item:MegaraptorSaddle', 'item:MegatheriumSaddle', 'item:MeiyinLiARKTheAnimatedSeriesCostumeSkinDearJane',
        'item:Mejoberry', 'item:MejoberrySeed', 'item:MentholColoring', 'item:MesopithecusARKTheAnimatedSeriesCostumeDearJane', 'item:Metal', 'item:MetalArrow',
        'item:MetalBehemothCellarDoor', 'item:MetalBehemothGate', 'item:MetalBehemothGateway', 'item:MetalBillboard', 'item:MetalCeilingHatchframe', 'item:MetalCliffPlatform',
        'item:MetalDoor', 'item:MetalFenceFoundationSupport', 'item:MetalFoundation', 'item:MetalGate', 'item:MetalGateway', 'item:MetalHatchet',
        'item:MetalIngot', 'item:MetalLadder', 'item:MetalLargeCellarDoor', 'item:MetalLargeWall', 'item:MetalOceanPlatform', 'item:MetalPick',
        'item:MetalPillar', 'item:MetalQuarterTriangleCeiling', 'item:MetalQuarterWallRailing', 'item:MetalRoofRampStairs', 'item:MetalShield', 'item:MetalSickle',
        'item:MetalSignWallSign', 'item:MetalSlopedWall', 'item:MetalSpikeWall', 'item:MetalSword', 'item:MetalTreePlatform', 'item:MetalTriangleFoundation',
        'item:MetalTriangleRoofCorner', 'item:MetalWallDoorwaysWindowframe', 'item:MetalWaterIntake', 'item:MetalWaterReservoir', 'item:MetalWaterTap', 'item:MicroraptorEgg',
        'item:MidnightColoring', 'item:MindwipeTonic', 'item:MinigunTurret', 'item:MiningDrill', 'item:MintColoring', 'item:Mirror',
        'item:MoederFlag', 'item:MoederTrophyEasy', 'item:MoederTrophyHard', 'item:MoederTrophyMedium', 'item:MoldColoring', 'item:MoonstoneColoring',
        'item:MorellatopsEgg', 'item:MorellatopsSaddle', 'item:MortarAndPestle', 'item:MosasaurPlatformSaddle', 'item:MosasaurSaddle', 'item:MosasaurTekSaddle',
        'item:MoschopsEgg', 'item:Motorboat', 'item:MudColoring', 'item:MushroomBrew', 'item:MustardColoring', 'item:NamelessVenom',
        'item:Narcoberry', 'item:NarcoberrySeed', 'item:Narcotic', 'item:NavyColoring', 'item:Netgun', 'item:NightVisionGoggles',
        'item:NoriColoring', 'item:Note', 'item:NotesonRockwellRecipes', 'item:NunatakEasyTribute', 'item:NunatakFlag', 'item:NunatakHardTribute',
        'item:NunatakMediumTribute', 'item:NyanzaColoring', 'item:Obsidian', 'item:OceanColoring', 'item:Oil', 'item:OilJar',
        'item:OilPump', 'item:OliveColoring', 'item:OmnidirectionalLamppost', 'item:OrangeColoring', 'item:OrcColoring', 'item:OrchidColoring',
        'item:OrganicPolymer', 'item:OtterARKTheAnimatedSeriesCostumeDearJane', 'item:OvercastColoring', 'item:OviraptorEgg', 'item:PachySaddle', 'item:PachycephalosaurusEgg',
        'item:PachyrhinosaurusEgg', 'item:PachyrhinosaurusSaddle', 'item:Paintbrush', 'item:PaintingCanvas', 'item:PairoSaursChibi', 'item:PalaeoctopusSaddle',
        'item:ParacerPlatformSaddle', 'item:ParacerSaddle', 'item:Parachute', 'item:ParasaurARKTheAnimatedSeriesCostumeDearJane', 'item:ParasaurEgg', 'item:ParasaurSaddle',
        'item:ParchmentColoring', 'item:PeachColoring', 'item:PegomastaxEgg', 'item:PelagornisEgg', 'item:PelagornisSaddle', 'item:Pelt',
        'item:PheromoneDart', 'item:PhiomiaSaddle', 'item:PhoenixEgg', 'item:Pike', 'item:PinkColoring', 'item:PistachioColoring',
        'item:PlantSpeciesXSeed', 'item:PlantSpeciesYSeed', 'item:PlantSpeciesYTrap', 'item:PlantSpeciesZFruit', 'item:PlantSpeciesZSeed', 'item:PlesiosaurPlatformSaddle',
        'item:PlesiosaurSaddle', 'item:Pliers', 'item:PlumColoring', 'item:PoisonGrenade', 'item:PoisonTalon', 'item:Polymer',
        'item:PortableRopeLadder', 'item:PreservingBin', 'item:PreservingSalt', 'item:PressurePlate', 'item:PrimalItemConsumable_BeerJarAlt-cdefd156', 'item:PrimalItemConsumable_Egg_Dimorph_Fertilized_Abberant-6fe97ac2',
        'item:PrimalItemStructure_Flag_KingKaijuMecha-e8b7d670', 'item:PrimalItemStructure_WaterTank-d3b789f1', 'item:PrimalItem_BossTribute_Manticore_Easy-894507f7', 'item:PrimalItem_BossTribute_Manticore_Hard-1d7c68e0', 'item:PrimalItem_BossTribute_Manticore_Medium-7a5b4ae7', 'item:PrimalItem_Spawner_Enforcer_CityTerminal-8bc800f4',
        'item:PrimalItem_WeaponScoutRemote_CityTerminal-b4d06dfc', 'item:PrimeMeatJerky', 'item:PrismaticInk', 'item:ProcoptodonSaddle', 'item:Propellant', 'item:PrussianColoring',
        'item:PteranodonARKTheAnimatedSeriesCostumeDearJane', 'item:PteranodonEgg', 'item:PteranodonSaddle', 'item:PulmonoscorpiusSaddle', 'item:PumpActionShotgun', 'item:Pumpkin',
        'item:PurpleColoring', 'item:PutrescenceColoring', 'item:QuetzPlatformSaddle', 'item:QuetzSaddle', 'item:QuetzalARKTheAnimatedSeriesCostumeDearJane', 'item:QuetzalEgg',
        'item:Radio', 'item:RaisinColoring', 'item:RaptorARKTheAnimatedSeriesCostumeDearJane', 'item:RaptorEgg', 'item:RaptorSaddle', 'item:RareChibiCrate',
        'item:RareFlower', 'item:RareMushroom', 'item:RavagerSaddle', 'item:RawFishMeat', 'item:RawMeat', 'item:RawMutton',
        'item:RawPrimeFishMeat', 'item:RawPrimeMeat', 'item:RawSalt', 'item:ReFertilizer', 'item:ReaperPheromoneGland', 'item:RedColoring',
        'item:RedCrystalizedSap', 'item:RedGem', 'item:RefiningForge', 'item:Refrigerator', 'item:RegularFertilizedMaeguanaEgg', 'item:RegularKibble',
        'item:RegularMaeguanaEgg', 'item:RemoteKeypad', 'item:Resin', 'item:RexARKTheAnimatedSeriesCostumeDearJane', 'item:RexBoneHelmetSkin', 'item:RexEgg',
        'item:RexSaddle', 'item:RhyniognathaPheromone', 'item:RhyniognathaSaddle', 'item:RiotBoots', 'item:RiotChestpiece', 'item:RiotGauntlets',
        'item:RiotHelmet', 'item:RiotLeggings', 'item:RiotShield', 'item:RockDrakeFeather', 'item:RockDrakeSaddle', 'item:RockDrakeTekSaddle',
        'item:RockGolemSaddle', 'item:Rockarrot', 'item:RockarrotSeed', 'item:RocketHomingMissile', 'item:RocketLauncher', 'item:RocketPod',
        'item:RocketPropelledGrenade', 'item:RocketTurret', 'item:RockwellEasyTribute', 'item:RockwellFlag', 'item:RockwellHardTribute', 'item:RockwellMediumTribute',
        'item:RockwellRecipesBattleTartare', 'item:RockwellRecipesCalienSoup', 'item:RockwellRecipesDecorativeColoring', 'item:RockwellRecipesEggbasedKibble', 'item:RockwellRecipesEnduroStew', 'item:RockwellRecipesEnergyBrew',
        'item:RockwellRecipesFocalChili', 'item:RockwellRecipesFriaCurry', 'item:RockwellRecipesIguanodonKibble', 'item:RockwellRecipesLazarusChowder', 'item:RockwellRecipesMeatJerky', 'item:RockwellRecipesMedicalBrew',
        'item:RockwellRecipesMindwipeTonic', 'item:RockwellRecipesPegomastaxKibble', 'item:RockwellRecipesShadowSteakSaut', 'item:RockwellTrophyAlpha', 'item:RockwellTrophyBeta', 'item:RockwellTrophyGamma',
        'item:RogueColoring', 'item:RollRatSaddle', 'item:RopeLadder', 'item:RoyaltyColoring', 'item:SCUBAFlippers', 'item:SCUBALeggings',
        'item:SCUBAMask', 'item:SCUBATank', 'item:SabertoothARKTheAnimatedSeriesCostumeDearJane', 'item:SabertoothSaddle', 'item:SaddleLootcrate', 'item:SalmonColoring',
        'item:Sand', 'item:SandColoring', 'item:SantaHatSkin', 'item:Sap', 'item:SapphireColoring', 'item:SarcoEgg',
        'item:SarcoSaddle', 'item:SarcosuchusSkin', 'item:SauropodVertebra', 'item:Savoroot', 'item:SavorootSeed', 'item:ScabColoring',
        'item:Scarecrow', 'item:Scissors', 'item:ScopeAttachment', 'item:ScoutRemote', 'item:ScrapMetal', 'item:ScrapMetalIngot',
        'item:SeafoamColoring', 'item:ShadowColoring', 'item:ShadowSteakSaute', 'item:ShagRug', 'item:ShamrockColoring', 'item:ShastasaurusSubmarineSaddle',
        'item:ShellFragment', 'item:ShockingTranquilizerDart', 'item:Shotgun', 'item:SilencerAttachment', 'item:SilicaPearls', 'item:Silicate',
        'item:Silk', 'item:SilverColoring', 'item:SimpleBed', 'item:SimpleBullet', 'item:SimpleFertilizedMaeguanaEgg', 'item:SimpleKibble',
        'item:SimpleMaeguanaEgg', 'item:SimplePistol', 'item:SimpleRifleAmmo', 'item:SimpleShotgunAmmo', 'item:SingleMultiPanelFlag', 'item:SkobeloffColoring',
        'item:SlateColoring', 'item:Slingshot', 'item:SlopedTekRoof', 'item:SmallAnimalFeces', 'item:SmallCropPlot', 'item:SmallElevatorPlatform',
        'item:SmallTekTeleporter', 'item:SmallWoodElevatorPlatform', 'item:Smithy', 'item:SmokeGrenade', 'item:SnowOwlEgg', 'item:SnowOwlPellet',
        'item:SnowOwlSaddle', 'item:Soap', 'item:Sparkpowder', 'item:Spear', 'item:SpearBolt', 'item:SpiderFlag',
        'item:SpinoEgg', 'item:SpinoSaddle', 'item:SpinosaurusSail', 'item:SpoiledMeat', 'item:SprayPainter', 'item:SpringColoring',
        'item:Spyglass', 'item:SquidOil', 'item:StandingTorch', 'item:SteelColoring', 'item:StegoEgg', 'item:StegoSaddle',
        'item:StegosaurusARKTheAnimatedSeriesCostumeDearJane', 'item:Stimberry', 'item:StimberrySeed', 'item:Stimulant', 'item:StolenHeadstone', 'item:StoneArrow',
        'item:StoneBehemothGateway', 'item:StoneCeilingHatchframe', 'item:StoneCliffPlatform', 'item:StoneFenceFoundationSupport', 'item:StoneFireplace', 'item:StoneFoundation',
        'item:StoneGateway', 'item:StoneHatchet', 'item:StoneLadder', 'item:StoneLargeWall', 'item:StonePick', 'item:StonePillar',
        'item:StoneQuarterTriangleCeiling', 'item:StoneQuarterWallRailing', 'item:StoneReinforcedBehemothCellarDoor', 'item:StoneReinforcedBehemothGate', 'item:StoneReinforcedDoorsWindows', 'item:StoneReinforcedGate',
        'item:StoneReinforcedLargeCellarDoor', 'item:StoneRoofRampStairs', 'item:StoneSlopedWall', 'item:StoneTreePlatform', 'item:StoneTriangleFoundation', 'item:StoneTriangleRoofCorner',
        'item:StoneWallDoorwaysWindowframe', 'item:StoneWaterIntake', 'item:StoneWaterTap', 'item:StorageBox', 'item:StreamColoring', 'item:Sulfur',
        'item:SummonAlphaKingTitan', 'item:SummonBetaKingTitan', 'item:SummonDesertTitan', 'item:SummonForestTitan', 'item:SummonGammaKingTitan', 'item:SummonIceTitan',
        'item:SuperiorFertilizedMaeguanaEgg', 'item:SuperiorKibble', 'item:SuperiorMaeguanaEgg', 'item:SwampColoring', 'item:SweetVegetableCake', 'item:TamingCakeSlice',
        'item:TanColoring', 'item:TangerineColoring', 'item:TapejaraEgg', 'item:TapejaraSaddle', 'item:TaxidermyBases', 'item:TaxidermyTool',
        'item:TealColoring', 'item:TekBehemothCellarDoor', 'item:TekBehemothGate', 'item:TekBehemothGateway', 'item:TekBinoculars', 'item:TekBoots',
        'item:TekBridge', 'item:TekCeilingHatchframe', 'item:TekChestpiece', 'item:TekClaws', 'item:TekCloningChamber', 'item:TekCropPlot',
        'item:TekDedicatedStorage', 'item:TekDoorsWindows', 'item:TekFenceFoundationSupport', 'item:TekForcefield', 'item:TekFoundation', 'item:TekGate',
        'item:TekGateway', 'item:TekGauntlets', 'item:TekGenerator', 'item:TekGiganotosaurusEgg', 'item:TekGravityGrenade', 'item:TekGrenade',
        'item:TekGrenadeLauncher', 'item:TekHelmet', 'item:TekJumpPad', 'item:TekLadder', 'item:TekLargeCellarDoor', 'item:TekLargeWall',
        'item:TekLeggings', 'item:TekLight', 'item:TekMegalodonSaddle', 'item:TekParasaurEgg', 'item:TekPillar', 'item:TekQuarterTriangleCeiling',
        'item:TekQuarterWallRailing', 'item:TekQuetzalEgg', 'item:TekRailgun', 'item:TekRaptorEgg', 'item:TekReplicator', 'item:TekRexEgg',
        'item:TekRexSaddle', 'item:TekRifle', 'item:TekRoofRampStairs', 'item:TekSensor', 'item:TekShield', 'item:TekShoulderCannon',
        'item:TekSleepingPod', 'item:TekSlopedWall', 'item:TekStegoEgg', 'item:TekSword', 'item:TekTapejaraSaddle', 'item:TekTransmitter',
        'item:TekTriangleFoundation', 'item:TekTriangleRoofCorner', 'item:TekTrikeEgg', 'item:TekTrough', 'item:TekTurret', 'item:TekWallDoorwaysWindowframe',
        'item:Tent', 'item:TerracottaColoring', 'item:TerrorBirdEgg', 'item:TerrorBirdSaddle', 'item:ThatchCeiling', 'item:ThatchDoorsWindow',
        'item:ThatchFenceFoundationSupport', 'item:ThatchFoundation', 'item:ThatchLadder', 'item:ThatchPillar', 'item:ThatchQuarterTriangleCeiling', 'item:ThatchQuarterWallRailing',
        'item:ThatchRoofStairs', 'item:ThatchSlopedWall', 'item:ThatchTriangleQuarterFoundation', 'item:ThatchTriangleRoofCorner', 'item:ThatchWallDoorway', 'item:TheCenterEasyTribute',
        'item:TheCenterHardTribute', 'item:TheCenterMediumTribute', 'item:TherizinoClaws', 'item:TherizinoEgg', 'item:TherizinosaurusSaddle', 'item:ThistleColoring',
        'item:ThornyDragonEgg', 'item:ThornyDragonSaddle', 'item:ThylacoleoHookClaw', 'item:ThylacoleoSaddle', 'item:Tier1Lootcrate', 'item:Tier2Lootcrate',
        'item:Tier3Lootcrate', 'item:Tintoberry', 'item:TintoberrySeed', 'item:TitanoboaEgg', 'item:TitanoboaVenom', 'item:TitanosaurPlatformSaddle',
        'item:Toilet', 'item:Torch', 'item:TorchSparkler', 'item:TorchSparklerSkin', 'item:TranqSpearBolt', 'item:TranquilizerArrow',
        'item:TranquilizerDart', 'item:TreeSapTap', 'item:TrikeEgg', 'item:TrikeSaddle', 'item:TripwireAlarmTrap', 'item:TripwireNarcoticTrap',
        'item:TroodonEgg', 'item:TrophyWallMount', 'item:TulipColoring', 'item:TurquoiseColoring', 'item:TusoteuthisSaddle', 'item:TusoteuthisTentacle',
        'item:TwilightColoring', 'item:TyrannosaurusArm', 'item:TyrianColoring', 'item:UmbraApexDrop', 'item:UnassembledEnforcer', 'item:UnassembledMek',
        'item:UnassembledTEKHoverSkiff', 'item:UncommonChibiCrate', 'item:UnstableElement', 'item:UnstableElementShard', 'item:VRBossFlag', 'item:VacuumCompartment',
        'item:ValentineColoring', 'item:VampireEyes', 'item:Vault', 'item:VelonasaurEgg', 'item:VelonasaurSaddle', 'item:Verdberry',
        'item:VerdberrySeed', 'item:VeryRareChibiCrate', 'item:Vessel', 'item:VioletColoring', 'item:VultureEgg', 'item:WallTorch',
        'item:WarMap', 'item:Wardrums', 'item:WaterJar', 'item:WaterJarFilled', 'item:WaterWell', 'item:Waterskin',
        'item:WaterskinFilled', 'item:WeaponLootcrate', 'item:WerewolfHat', 'item:Whip', 'item:WhiteColoring', 'item:WindTurbine',
        'item:WindsorColoring', 'item:WispColoring', 'item:WitchHatSkin', 'item:WoodBehemothCellarDoor', 'item:WoodBehemothGate', 'item:WoodBehemothGateway',
        'item:WoodBillboard', 'item:WoodCage', 'item:WoodCeilingHatchframe', 'item:WoodCliffPlatform', 'item:WoodDoorsWindows', 'item:WoodElevatorTrack',
        'item:WoodFenceFoundationSupport', 'item:WoodFoundation', 'item:WoodGate', 'item:WoodGateway', 'item:WoodLadder', 'item:WoodLargeCellarDoor',
        'item:WoodLargeWall', 'item:WoodOceanPlatform', 'item:WoodPillar', 'item:WoodQuarterTriangleCeiling', 'item:WoodQuarterWallRailing', 'item:WoodRoofRampStairs',
        'item:WoodSignWallSign', 'item:WoodSlopedWall', 'item:WoodSpikeWall', 'item:WoodTriangleRoofCorner', 'item:WoodWallDoorwaysWindowframe', 'item:WoodenBench',
        'item:WoodenChair', 'item:WoodenClub', 'item:WoodenRaft', 'item:WoodenShield', 'item:WoodenTable', 'item:WoodenTreePlatform',
        'item:WoodenTriangleFoundation', 'item:Wool', 'item:WoollyRhinoHorn', 'item:WoollyRhinoSaddle', 'item:WyvernMilk', 'item:XiphactinusSaddle',
        'item:YellowColoring', 'item:YiLingEgg', 'item:YiLingSaddle', 'item:YutyrannusARKTheAnimatedSeriesCostumeDearJane', 'item:YutyrannusEgg', 'item:YutyrannusLungs',
        'item:YutyrannusSaddle', 'item:ZipLineAnchor', 'item:ZipLineMotorAttachment'
    ]::text[]
$$;

create or replace function public.icepack_hosted_reward_ids()
returns text[] language sql immutable set search_path = '' as $$
    select array['rose-stone','wood-5','thatch-5','wild-dodo','wild-raptor','wild-rex','starter-kit','custom-kit']::text[]
        || (public.icepack_hosted_item_ids())[4:]
$$;

alter table public.icepack_relay_servers add column max_item_quantities jsonb not null default '{}'::jsonb;
alter table public.icepack_relay_deliveries add column item_quantities jsonb not null default '{}'::jsonb;
alter table public.companion_relay_tests add column item_quantities jsonb not null default '{}'::jsonb;

create function public.icepack_hosted_quantity_valid(p_value jsonb)
returns boolean language sql immutable set search_path = '' as $$
    select case when jsonb_typeof(p_value) = 'number'
        then p_value::numeric between 1 and 100 and p_value::numeric = trunc(p_value::numeric)
        else false end
$$;

-- Quantity maps omit the existing five-item default so old drafts and queued rows keep their meaning.
create function public.icepack_hosted_quantities_allowed(
    p_limits jsonb, p_reward text, p_kit_rewards text[], p_quantities jsonb
) returns boolean language sql immutable set search_path = '' as $$
    select not exists (
        select 1 from unnest(case p_reward when 'starter-kit' then array['rose-stone']::text[]
            when 'custom-kit' then p_kit_rewards else array[p_reward] end) as rewards(id)
        where p_limits ? id and coalesce((p_quantities -> id)::numeric, 5) > (p_limits -> id)::numeric
    )
$$;

create function public.icepack_hosted_recipe_allowed(
    p_policy text, p_rewards text[], p_limits jsonb, p_reward text, p_kit_rewards text[], p_quantities jsonb
) returns boolean language sql immutable set search_path = '' as $$
    select public.icepack_reward_allowed(p_policy, p_rewards, p_reward, p_kit_rewards)
        and public.icepack_hosted_quantities_allowed(p_limits, p_reward, p_kit_rewards, p_quantities)
$$;

-- Older relay builds understand only the original catalog and its default quantities.
create function public.icepack_hosted_legacy_plan(p_reward text, p_kit_rewards text[], p_quantities jsonb)
returns boolean language sql immutable set search_path = '' as $$
    select p_quantities = '{}'::jsonb
        and (array[p_reward] || p_kit_rewards) <@ (public.icepack_hosted_reward_ids())[1:8]
$$;

create function public.icepack_hosted_action(p_action jsonb)
returns table (reward_id text, quantity integer) language sql immutable set search_path = '' as $$
    with item as (
        select case p_action ->> 'catalogId'
            when 'Stone' then 'rose-stone' when 'Wood' then 'wood-5' when 'Thatch' then 'thatch-5'
            else 'item:' || (p_action ->> 'catalogId') end as id
        where p_action ->> 'type' = 'item' and p_action ->> 'announcement' = ''
            and p_action -> 'quality' = '0'::jsonb and public.icepack_hosted_quantity_valid(p_action -> 'quantity')
    )
    select id, (p_action -> 'quantity')::numeric::integer from item where id = any(public.icepack_hosted_item_ids())
    union all
    select public.icepack_hosted_recipe(p_action, '[]'::jsonb), null::integer
    where p_action ->> 'type' = 'dinosaur'
$$;

create function public.icepack_hosted_kit_plans(p_kits jsonb)
returns table (kit_id text, kit_name text, reward_ids text[], item_quantities jsonb)
language sql immutable set search_path = '' as $$
    with unique_kits as (
        select kit, count(*) over (partition by kit ->> 'id') as matches
        from jsonb_array_elements(case when jsonb_typeof(p_kits) = 'array' then p_kits else '[]'::jsonb end) kit
    )
    select kit ->> 'id',
        coalesce(nullif(left(btrim(kit ->> 'name'), 120), ''), 'Custom Kit'),
        steps.ids, steps.quantities
    from unique_kits
    cross join lateral (
        select array_agg(reward_id order by position) as ids, count(*) as step_count,
            count(distinct reward_id) as distinct_count,
            count(*) filter (where reward_id like 'wild-%') as creatures,
            coalesce(jsonb_object_agg(reward_id, quantity) filter (where reward_id is not null and quantity <> 5), '{}'::jsonb) as quantities
        from jsonb_array_elements(case when jsonb_typeof(kit -> 'entries') = 'array' then
            case when jsonb_array_length(kit -> 'entries') between 2 and 4 then kit -> 'entries' else '[]'::jsonb end
            else '[]'::jsonb end) with ordinality as entry(value, position)
        left join lateral public.icepack_hosted_action(entry.value -> 'action') recipe on true
    ) steps
    where matches = 1 and jsonb_typeof(kit -> 'id') = 'string' and char_length(kit ->> 'id') between 1 and 120
        and steps.step_count between 2 and 4 and steps.distinct_count = steps.step_count and steps.creatures <= 1
        and (steps.ids <> array['rose-stone','wild-dodo']::text[] or steps.quantities <> '{}'::jsonb)
$$;

create function public.icepack_hosted_gift_plans(p_draft jsonb)
returns table (gift_id text, reward_id text, kit_rewards text[], kit_name text, item_quantities jsonb) language sql immutable set search_path = '' as $$
    with kits as materialized (select * from public.icepack_hosted_kit_plans(p_draft -> 'kits'))
    select rule ->> 'giftId',
        case when kit.kit_id is not null then 'custom-kit'
            when rule -> 'action' ->> 'type' = 'kit' then public.icepack_hosted_recipe(rule -> 'action', p_draft -> 'kits')
            else direct.reward_id end,
        kit.reward_ids, kit.kit_name,
        coalesce(kit.item_quantities, case when direct.quantity <> 5 then jsonb_build_object(direct.reward_id, direct.quantity)
            else '{}'::jsonb end)
    from jsonb_array_elements(case when jsonb_typeof(p_draft -> 'rules') = 'array' then p_draft -> 'rules' else '[]'::jsonb end) rule
    left join kits kit on kit.kit_id = rule -> 'action' ->> 'kitId'
        and rule -> 'action' ->> 'type' = 'kit' and rule -> 'action' ->> 'announcement' = ''
    left join lateral public.icepack_hosted_action(rule -> 'action') direct on true
    where rule -> 'enabled' = 'true'::jsonb and jsonb_typeof(rule -> 'giftId') = 'string'
      and rule ->> 'giftId' ~ '^[1-9][0-9]{0,19}$'
$$;

create or replace function public.icepack_hosted_draft_rules(p_draft jsonb)
returns table (gift_id text, reward_id text) language sql immutable set search_path = '' as $$
    select recipes.gift_id, recipes.reward_id from public.icepack_hosted_gift_plans(p_draft) recipes
$$;

create or replace function public.icepack_relay_dashboard(p_actor uuid, p_search text)
returns jsonb language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
        'owned', (
            select jsonb_build_object('id', s.id, 'name', s.name, 'listed', s.listed, 'hourlyLimit', s.hourly_limit, 'rewardPolicy', s.reward_policy, 'roseWhitelisted', s.rose_whitelisted,
                'allowedRewardIds', s.allowed_reward_ids, 'maxItemQuantities', s.max_item_quantities,
                'access', coalesce((
                    select jsonb_agg(jsonb_build_object('streamerId', a.streamer_id, 'survivorId', a.survivor_id,
                        'state', a.state, 'email', u.email) order by a.state, u.email)
                    from public.icepack_relay_access a join auth.users u on u.id = a.streamer_id
                    where a.server_id = s.id
                ), '[]'::jsonb),
                'history', coalesce((
                    select jsonb_agg(history order by history."createdAt" desc)
                    from (select d.request_id as "requestId", d.created_at as "createdAt", d.state, d.source, d.reward_id as "rewardId",
                            case when d.reward_id = 'rose-stone' and d.state = 'acknowledged' then 1
                                else d.acknowledged_commands end as "acknowledgedCommands",
                            d.item_quantities as "itemQuantities", d.kit_name as "kitName", d.kit_reward_ids as "kitRewardIds",
                            coalesce(cardinality(d.kit_reward_ids), case when d.reward_id = 'starter-kit' then 2 else 1 end) as "totalCommands",
                            coalesce(u.email, 'Former streamer') as streamer
                        from public.icepack_relay_deliveries d left join auth.users u on u.id = d.streamer_id
                        where d.server_id = s.id order by d.created_at desc limit 20) as history
                ), '[]'::jsonb))
            from public.icepack_relay_servers s where s.owner_id = p_actor
        ),
        'linked', coalesce((
            select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'state', a.state, 'survivorId', a.survivor_id,
                'roseAllowed', (s.reward_policy = 'all_supported' or s.rose_whitelisted),
                'maxItemQuantities', s.max_item_quantities,
                'allowedRewardIds', public.icepack_effective_rewards(s.reward_policy, s.allowed_reward_ids)) order by s.name)
            from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
            where a.streamer_id = p_actor
        ), '[]'::jsonb),
        'savedKits', coalesce((
            select jsonb_agg(jsonb_build_object('id', kit.kit_id, 'name', kit.kit_name, 'rewardIds', kit.reward_ids,
                'itemQuantities', kit.item_quantities, 'revision', draft.revision)
                order by kit.kit_name, kit.kit_id)
            from public.companion_drafts draft
            cross join lateral public.icepack_hosted_kit_plans(draft.draft -> 'kits') kit
            where draft.user_id = p_actor and exists (
                select 1 from public.icepack_relay_access a join public.icepack_relay_servers s on s.id = a.server_id
                where a.streamer_id = p_actor and a.state = 'approved'
                  and public.icepack_hosted_recipe_allowed(s.reward_policy, s.allowed_reward_ids, s.max_item_quantities,
                      'custom-kit', kit.reward_ids, kit.item_quantities)
            )
        ), '[]'::jsonb),
        'results', coalesce((
            select jsonb_agg(results order by results.name)
            from (select s.id, s.name from public.icepack_relay_servers s where s.listed and s.owner_id <> p_actor
                and char_length(p_search) >= 2 and strpos(lower(s.name), lower(p_search)) > 0
                order by s.name limit 20) as results
        ), '[]'::jsonb)
    )
$$;

create function public.icepack_relay_reward_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text,
    p_kit_rewards text[], p_kit_name text, p_kit_revision uuid, p_quantities jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare server public.icepack_relay_servers;
declare access public.icepack_relay_access;
declare previous public.icepack_relay_deliveries;
begin
    -- All admission, approval and revocation decisions use this same per-server lock.
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    if p_reward is null or not (p_reward = any(public.icepack_hosted_reward_ids())) then
        return jsonb_build_object('error', 'Unknown hosted reward.', 'status', 400);
    end if;
    if not public.icepack_reward_allowed(server.reward_policy, server.allowed_reward_ids, p_reward, p_kit_rewards) then
        return jsonb_build_object('error', 'The owner whitelist does not allow this reward.', 'status', 403);
    end if;
    if not public.icepack_hosted_quantities_allowed(server.max_item_quantities, p_reward, p_kit_rewards, p_quantities) then
        return jsonb_build_object('error', 'The reward exceeds the server owner’s item quantity limit.', 'status', 403);
    end if;
    select * into access from public.icepack_relay_access where server_id = p_server and streamer_id = p_actor;
    if access.state is distinct from 'approved' then
        return jsonb_build_object('error', 'The server owner must approve your access.', 'status', 403);
    end if;
    select * into previous from public.icepack_relay_deliveries
        where server_id = p_server and streamer_id = p_actor and request_id = p_request;
    if p_phase in ('dispatch','continue') and previous.request_id is not null
       and (previous.item_quantities is distinct from p_quantities
            or previous.kit_draft_revision is distinct from p_kit_revision
            or previous.kit_reward_ids is distinct from p_kit_rewards) then
        return jsonb_build_object('error', 'The reward changed during delivery.', 'status', 409);
    end if;
    if p_phase = 'continue' then
        if p_reward not in ('starter-kit','custom-kit') or previous.reward_id is distinct from p_reward or previous.state is distinct from 'sending'
           or previous.survivor_at_reserve is distinct from access.survivor_id
           or previous.created_at <= clock_timestamp() - interval '30 seconds' then
            return jsonb_build_object('error', 'The remaining Kit step was stopped.', 'status', 409);
        end if;
        return jsonb_build_object('survivorId', access.survivor_id);
    end if;
    if p_phase = 'dispatch' then
        update public.icepack_relay_deliveries set state = 'sending'
            where server_id = p_server and streamer_id = p_actor and request_id = p_request
                and state = 'pending' and reward_id = p_reward and created_at > clock_timestamp() - interval '30 seconds'
                and (survivor_at_reserve is null or survivor_at_reserve = access.survivor_id);
        if not found then return jsonb_build_object('error', 'The test expired or was cancelled.', 'status', 409); end if;
        return jsonb_build_object('survivorId', access.survivor_id);
    end if;
    if p_phase <> 'reserve' then return jsonb_build_object('error', 'Invalid delivery phase.', 'status', 400); end if;
    if previous.request_id is not null then return jsonb_build_object('error', 'This test was already submitted.', 'status', 409); end if;

    update public.icepack_relay_deliveries
        set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
        where server_id = p_server and state in ('pending','sending') and created_at <= clock_timestamp() - interval '30 seconds';

    if exists (select 1 from public.icepack_relay_deliveries where server_id = p_server and state in ('pending','sending')) then
        return jsonb_build_object('error', 'Wait for the active server reward to finish.', 'status', 429);
    end if;
    if exists (select 1 from public.icepack_relay_deliveries where server_id = p_server and created_at > clock_timestamp() - interval '15 seconds') then
        return jsonb_build_object('error', 'Wait 15 seconds between server rewards.', 'status', 429);
    end if;
    if (select count(*) from public.icepack_relay_deliveries where server_id = p_server
        and created_at > clock_timestamp() - interval '1 hour') >= server.hourly_limit then
        return jsonb_build_object('error', 'This server reached its hourly reward limit.', 'status', 429);
    end if;
    insert into public.icepack_relay_deliveries (
        server_id, streamer_id, request_id, state, reward_id, survivor_at_reserve,
        kit_reward_ids, kit_name, kit_draft_revision, item_quantities
    ) values (
        p_server, p_actor, p_request, 'pending', p_reward, access.survivor_id,
        p_kit_rewards, p_kit_name, p_kit_revision, p_quantities
    );
    return jsonb_build_object('envelope', (select envelope from public.icepack_relay_vault where server_id = p_server),
        'kitRewardIds', p_kit_rewards, 'kitName', p_kit_name, 'itemQuantities', p_quantities);
end;
$$;

create or replace function public.icepack_relay_reward_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text,
    p_kit_rewards text[], p_kit_name text, p_kit_revision uuid
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, p_reward,
        p_kit_rewards, p_kit_name, p_kit_revision, '{}'::jsonb)
$$;

create function public.icepack_relay_catalog_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_reward text, p_quantity integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare quantities jsonb := '{}'::jsonb;
begin
    if p_quantity is not null then
        if (p_reward = any(public.icepack_hosted_item_ids())) is not true or p_quantity not between 1 and 100 then
            return jsonb_build_object('error', 'Choose an item quantity between 1 and 100.', 'status', 400);
        end if;
        if p_quantity <> 5 then quantities := jsonb_build_object(p_reward, p_quantity); end if;
    end if;
    return public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, p_reward,
        null, null, null, quantities);
end;
$$;

create function public.icepack_relay_saved_kit_delivery(p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_kit_id text, p_revision uuid, p_supports_quantities boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.companion_drafts;
declare kit record;
begin
    -- Use the same lock order as live delivery and owner policy changes.
    perform 1 from public.icepack_relay_servers where id = p_server for update;
    if not found then return jsonb_build_object('error', 'Server unavailable.', 'status', 404); end if;
    select * into saved from public.companion_drafts where user_id = p_actor and revision = p_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Kits changed. Refresh access and select the Kit again.', 'status', 409); end if;
    select * into kit from public.icepack_hosted_kit_plans(saved.draft -> 'kits') where kit_id = p_kit_id;
    if not found then return jsonb_build_object('error', 'Save a supported custom Kit to your Northpath account first.', 'status', 409); end if;
    if p_supports_quantities is not true and not public.icepack_hosted_legacy_plan('custom-kit', kit.reward_ids, kit.item_quantities) then
        return jsonb_build_object('error', 'The relay needs an update for this Kit.', 'status', 409);
    end if;
    return public.icepack_relay_reward_delivery(p_actor, p_server, p_request, p_phase, 'custom-kit',
        kit.reward_ids, kit.kit_name, saved.revision, kit.item_quantities);
end;
$$;

create or replace function public.icepack_relay_saved_kit_delivery(
    p_actor uuid, p_server uuid, p_request uuid, p_phase text, p_kit_id text, p_revision uuid
) returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_saved_kit_delivery(p_actor, p_server, p_request, p_phase, p_kit_id, p_revision, false)
$$;

create function public.icepack_relay_catalog_policy(p_actor uuid, p_server uuid, p_policy text, p_rewards text[], p_limits jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_limits jsonb;
begin
    if p_policy is null or p_policy not in ('whitelist','all_supported') or p_rewards is null
       or array_position(p_rewards, null) is not null
       or (p_rewards <@ public.icepack_hosted_reward_ids()) is not true
       or cardinality(p_rewards) <> (select count(distinct id) from unnest(p_rewards) id)
    then return jsonb_build_object('error', 'Choose a valid reward whitelist.', 'status', 400); end if;
    if p_limits is not null and jsonb_typeof(p_limits) <> 'object' then
        return jsonb_build_object('error', 'Set valid item quantity limits.', 'status', 400);
    end if;
    if exists (select 1 from jsonb_each(p_limits) as limit_entry(id, quantity)
        where not (id = any(public.icepack_hosted_item_ids())) or not public.icepack_hosted_quantity_valid(quantity)) then
        return jsonb_build_object('error', 'Set valid item quantity limits.', 'status', 400);
    end if;

    update public.icepack_relay_servers set reward_policy = p_policy, allowed_reward_ids = p_rewards,
        rose_whitelisted = 'rose-stone' = any(p_rewards),
        max_item_quantities = coalesce(p_limits, max_item_quantities)
        where id = p_server and owner_id = p_actor returning max_item_quantities into current_limits;
    if not found then return jsonb_build_object('error', 'Server owner access is required.', 'status', 403); end if;
    if not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, 'rose-stone', null, '{}'::jsonb) then
        delete from public.companion_relay_tests where server_id = p_server and source <> 'live_draft';
    end if;
    delete from public.companion_relay_tests where server_id = p_server and source = 'live_draft'
        and not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, reward_id, kit_reward_ids, item_quantities);
    update public.icepack_relay_deliveries
        set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
        where server_id = p_server and (state = 'pending' or (reward_id in ('starter-kit','custom-kit') and state = 'sending'))
          and not public.icepack_hosted_recipe_allowed(p_policy, p_rewards, current_limits, reward_id, kit_reward_ids, item_quantities);
    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.icepack_relay_catalog_policy(p_actor uuid, p_server uuid, p_policy text, p_rewards text[])
returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_catalog_policy(p_actor, p_server, p_policy, p_rewards, null)
$$;

create or replace function public.authorize_companion_draft_gift(
    p_device_secret text, p_server uuid, p_survivor text, p_gift text, p_token_hash text, p_event_hash text
) returns text language plpgsql security definer set search_path = '' as $$
declare device public.companion_devices;
declare server public.icepack_relay_servers;
declare saved public.companion_drafts;
declare recipe record;
begin
    if p_device_secret is null or p_device_secret !~ '^[0-9a-f]{64}$' then return 'stopped'; end if;
    select * into device from public.companion_devices
        where pairing_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_device_secret, 'UTF8')), 'hex')
        for share;
    if not found then return 'stopped'; end if;
    select * into server from public.icepack_relay_servers where id = p_server for update;
    if not found then return 'stopped'; end if;
    if p_token_hash is null and p_event_hash is null and p_gift is null then
        delete from public.companion_relay_tests
            where server_id = p_server and streamer_id = device.user_id and source = 'live_draft';
        update public.icepack_relay_deliveries
            set state = case state when 'pending' then 'cancelled' else 'unconfirmed' end
            where server_id = p_server and streamer_id = device.user_id and source = 'live_draft'
                and (state = 'pending' or (reward_id in ('starter-kit','custom-kit') and state = 'sending'));
        return 'stopped';
    end if;
    if not exists (select 1 from public.icepack_relay_access where server_id = p_server
        and streamer_id = device.user_id and state = 'approved' and survivor_id = p_survivor)
    then return 'stopped'; end if;
    if p_gift is null or p_gift !~ '^[1-9][0-9]{0,19}$' or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
       or p_event_hash is null or p_event_hash !~ '^[0-9a-f]{64}$' then return 'ignored'; end if;
    select * into saved from public.companion_drafts where user_id = device.user_id;
    if not found then return 'ignored'; end if;

    select r.reward_id, r.kit_rewards, r.kit_name, r.item_quantities into recipe from (
        select recipes.*, count(*) over () as matches
        from public.icepack_hosted_gift_plans(saved.draft) recipes where gift_id = p_gift
    ) r where r.matches = 1;
    if not found or not public.icepack_hosted_recipe_allowed(server.reward_policy, server.allowed_reward_ids, server.max_item_quantities,
        recipe.reward_id, recipe.kit_rewards, recipe.item_quantities)
    then return 'ignored'; end if;

    insert into public.companion_relay_tests (
        token_hash, pairing_hash, server_id, streamer_id, survivor_id, request_id,
        source, draft_revision, reward_id, kit_reward_ids, kit_name, item_quantities
    ) values (
        p_token_hash, device.pairing_hash, p_server, device.user_id, p_survivor, substr(p_event_hash, 1, 32)::uuid,
        'live_draft', saved.revision, recipe.reward_id, recipe.kit_rewards, recipe.kit_name, recipe.item_quantities
    )
    on conflict (server_id, streamer_id) do update set token_hash = excluded.token_hash,
        pairing_hash = excluded.pairing_hash, survivor_id = excluded.survivor_id,
        request_id = excluded.request_id, expires_at = excluded.expires_at, source = excluded.source,
        draft_revision = excluded.draft_revision, reward_id = excluded.reward_id,
        kit_reward_ids = excluded.kit_reward_ids, kit_name = excluded.kit_name, item_quantities = excluded.item_quantities;
    return 'ready';
end;
$$;

create function public.icepack_relay_hosted_gift_delivery(p_token_hash text, p_owner uuid, p_phase text, p_request uuid, p_supports_quantities boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash and source = 'live_draft';
    if not found or (p_phase <> 'reserve' and arm.request_id is distinct from p_request) then
        return jsonb_build_object('error', 'Gift authorization changed or expired.', 'status', 403);
    end if;
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests t
        where t.token_hash = p_token_hash and t is not distinct from arm and t.expires_at > clock_timestamp())
       or not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id)
    then return jsonb_build_object('error', 'Gift approval changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_drafts where user_id = arm.streamer_id and revision = arm.draft_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Gift Rules changed during delivery.', 'status', 409); end if;
    if p_supports_quantities is not true and not public.icepack_hosted_legacy_plan(arm.reward_id, arm.kit_reward_ids, arm.item_quantities) then
        return jsonb_build_object('error', 'The relay needs an update for this reward.', 'status', 409);
    end if;
    result := public.icepack_relay_reward_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id,
        arm.kit_reward_ids, arm.kit_name, case when arm.reward_id = 'custom-kit' then arm.draft_revision end, arm.item_quantities);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

create or replace function public.icepack_relay_hosted_gift_delivery(p_token_hash text, p_owner uuid, p_phase text, p_request uuid)
returns jsonb language sql security definer set search_path = '' as $$
    select public.icepack_relay_hosted_gift_delivery(p_token_hash, p_owner, p_phase, p_request, false)
$$;

create or replace function public.icepack_relay_draft_delivery(p_token_hash text, p_owner uuid, p_phase text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare arm public.companion_relay_tests;
declare result jsonb;
begin
    select * into arm from public.companion_relay_tests where token_hash = p_token_hash and source = 'live_draft';
    if not found then return jsonb_build_object('error', 'Gift authorization changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_devices
        where user_id = arm.streamer_id and pairing_hash = arm.pairing_hash for share;
    if not found then return jsonb_build_object('error', 'Pair Companion with Northpath again.', 'status', 403); end if;
    perform 1 from public.icepack_relay_servers where id = arm.server_id and owner_id = p_owner for update;
    if not found or not exists (select 1 from public.companion_relay_tests
        where token_hash = p_token_hash and source = 'live_draft' and expires_at > clock_timestamp())
       or not exists (select 1 from public.icepack_relay_access where server_id = arm.server_id
        and streamer_id = arm.streamer_id and state = 'approved' and survivor_id = arm.survivor_id)
    then return jsonb_build_object('error', 'Gift approval changed or expired.', 'status', 403); end if;
    perform 1 from public.companion_drafts where user_id = arm.streamer_id and revision = arm.draft_revision for share;
    if not found then return jsonb_build_object('error', 'The saved Gift Rules changed during delivery.', 'status', 409); end if;
    if not public.icepack_hosted_legacy_plan(arm.reward_id, arm.kit_reward_ids, arm.item_quantities) then
        return jsonb_build_object('error', 'The relay needs an update for this reward.', 'status', 409);
    end if;
    result := public.icepack_relay_catalog_delivery(arm.streamer_id, arm.server_id, arm.request_id, p_phase, arm.reward_id);
    if p_phase = 'reserve' and not (result ? 'error') then
        update public.icepack_relay_deliveries set source = 'live_draft'
            where server_id = arm.server_id and streamer_id = arm.streamer_id and request_id = arm.request_id;
        result := result || jsonb_build_object('actor', arm.streamer_id, 'server', arm.server_id, 'request', arm.request_id, 'rewardId', arm.reward_id);
    end if;
    return result;
end;
$$;

revoke execute on function public.icepack_hosted_item_ids(), public.icepack_hosted_quantity_valid(jsonb),
    public.icepack_hosted_quantities_allowed(jsonb,text,text[],jsonb),
    public.icepack_hosted_recipe_allowed(text,text[],jsonb,text,text[],jsonb),
    public.icepack_hosted_legacy_plan(text,text[],jsonb), public.icepack_hosted_action(jsonb),
    public.icepack_hosted_kit_plans(jsonb), public.icepack_hosted_gift_plans(jsonb),
    public.icepack_relay_reward_delivery(uuid,uuid,uuid,text,text,text[],text,uuid,jsonb),
    public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text,integer),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[],jsonb),
    public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid,boolean),
    public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.icepack_relay_catalog_delivery(uuid,uuid,uuid,text,text,integer),
    public.icepack_relay_catalog_policy(uuid,uuid,text,text[],jsonb),
    public.icepack_relay_saved_kit_delivery(uuid,uuid,uuid,text,text,uuid,boolean),
    public.icepack_relay_hosted_gift_delivery(text,uuid,text,uuid,boolean) to service_role;

commit;
