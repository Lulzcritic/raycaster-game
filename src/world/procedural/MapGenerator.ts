import { TILE_TYPE } from '../../config/constants';
import { ItemDatabase } from '../../config/ItemDatabase';
import type {
  DoorSpawnData,
  EnemySpawnData,
  ExtractionSpawnData,
  LevelData,
  SpriteSpawnData,
} from '../../types';

export interface MapGeneratorOptions {
  size?: number;
  numPlayers?: number;
  seed?: number;
}

export class MapGenerator {
  public static readonly DEFAULT_SIZE = 65;
  public static readonly NUM_SECTORS = 6;

  /**
   * Génère un niveau d'extraction complet en miroir à 6 secteurs.
   *
   * RÈGLES STRICTES DE GÉNÉRATION :
   * 1. AUCUN couloir ou ligne de vue ne dépasse 7 unités (tous les tronçons font 2 à 4 cases
   *    avec des virages à 90°, doglegs et chicanes pour éliminer la pixellisation du raycaster).
   * 2. TOUTES les portes (6 de secteur, 6 de sanctuaire) sont fermement encastrées dans des murs
   *    pleins (flanquées de murs de part et d'autre, ouverture de 1 case uniquement).
   * 3. Chaque zone de spawn est un mini-labyrinthe de catacombes (Crypte de Réveil, Antichambre,
   *    Crypte de la Clé avec gardien, Armurerie avec équipement, Vestibule de Herse).
   */
  public static generate(options: MapGeneratorOptions = {}): LevelData {
    const size = options.size ?? MapGenerator.DEFAULT_SIZE;
    const center = Math.floor(size / 2); // 32 pour size = 65

    // Initialisation : carte entièrement remplie de murs solides
    const grid: number[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => TILE_TYPE.WALL_1)
    );
    const floorGrid: number[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => TILE_TYPE.GROUND_1)
    );

    const chestLoots: Record<string, string[]> = {};
    const enemies: EnemySpawnData[] = [];
    const doors: DoorSpawnData[] = [];
    const extractions: ExtractionSpawnData[] = [];
    const sprites: SpriteSpawnData[] = [];
    const playerSpawns: Array<{ x: number; y: number; angle: number }> = [];

    // Helper pour creuser une case individuelle
    const carve = (
      x: number,
      y: number,
      floorTile: number = TILE_TYPE.GROUND_1
    ): void => {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (ix >= 1 && ix < size - 1 && iy >= 1 && iy < size - 1) {
        grid[iy][ix] = TILE_TYPE.GROUND_1;
        floorGrid[iy][ix] = floorTile;
      }
    };

    // Helper pour creuser une pièce rectangulaire fermée
    const carveRoom = (
      cx: number,
      cy: number,
      rx = 1,
      ry = 1,
      floorTile: number = TILE_TYPE.GROUND_1
    ): void => {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          carve(cx + dx, cy + dy, floorTile);
        }
      }
    };

    // Helper pour tracer des couloirs orthogonaux stricts (1 seule case de large)
    const carveOrthogonal = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      floorTile: number = TILE_TYPE.GROUND_1
    ): void => {
      if (x1 === x2) {
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        for (let y = minY; y <= maxY; y++) carve(x1, y, floorTile);
      } else if (y1 === y2) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        for (let x = minX; x <= maxX; x++) carve(x, y1, floorTile);
      } else {
        // Virage en L (dogleg)
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        for (let x = minX; x <= maxX; x++) carve(x, y1, floorTile);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        for (let y = minY; y <= maxY; y++) carve(x2, y, floorTile);
      }
    };

    // Helper pour insérer une porte solidement encastrée entre 2 murs
    const addDoor = (
      x: number,
      y: number,
      orientation: 'horizontal' | 'vertical',
      requiredKeyId: string
    ): void => {
      grid[y][x] = TILE_TYPE.DOOR;
      if (orientation === 'horizontal') {
        grid[y][x - 1] = TILE_TYPE.WALL_1;
        grid[y][x + 1] = TILE_TYPE.WALL_1;
        carve(x, y - 1);
        carve(x, y + 1);
      } else {
        grid[y - 1][x] = TILE_TYPE.WALL_1;
        grid[y + 1][x] = TILE_TYPE.WALL_1;
        carve(x - 1, y);
        carve(x + 1, y);
      }
      doors.push({ x, y, requiredKeyId });
    };

    // =========================================================================
    // ÉTAPE 1 : ZONE 3 - SANCTUAIRE CENTRAL DU BOSS (r <= 4.0)
    // =========================================================================
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (Math.hypot(dx, dy) <= 4.0) {
          carve(center + dx, center + dy, TILE_TYPE.GROUND_2);
        }
      }
    }

    // Piliers de l'arène + Autel central en obsidienne pour casser toute vue axiale
    const sanctumPillars = [
      [center, center], // Autel central
      [center - 2, center - 2],
      [center + 2, center - 2],
      [center - 2, center + 2],
      [center + 2, center + 2],
    ];
    for (const [px, py] of sanctumPillars) {
      grid[py][px] = TILE_TYPE.WALL_1;
    }

    // Boss final de la Zone 3 : Choix entre le Roi Gâteau à la Carotte et la Reine de Sang
    const bossTypeId = Math.random() < 0.6 ? 'carrot_cake_king' : 'blood_queen';
    enemies.push({
      typeId: bossTypeId,
      x: center + 0.5,
      y: center + 1.5,
    });
    extractions.push({
      x: center + 0.5,
      y: center - 2.5,
      name: 'Portail Royal du Sanctuaire',
      activationDelaySec: 75,
    });

    // 2 Coffres Royaux du Sanctuaire
    const royalChest1 = { x: center - 3, y: center };
    const royalChest2 = { x: center + 3, y: center };
    grid[royalChest1.y][royalChest1.x] = TILE_TYPE.CHEST;
    grid[royalChest2.y][royalChest2.x] = TILE_TYPE.CHEST;
    chestLoots[`${royalChest1.x},${royalChest1.y}`] = [
      'weapon_crooked_phylactery_dagger',
      'armor_shrunk_black_mass_robe',
    ];
    chestLoots[`${royalChest2.x},${royalChest2.y}`] = [
      'weapon_arthritic_lich_staff',
      'armor_cursed_bone_carapace',
    ];

    // 6 Portes du Sanctuaire fermement encastrées dans le mur d'enceinte (r ~ 5.5)
    addDoor(32, 37, 'horizontal', 'key_crypt_skull'); // Sud
    addDoor(32, 27, 'horizontal', 'key_crypt_skull'); // Nord
    addDoor(36, 34, 'vertical', 'key_crypt_skull');   // Est-Sud-Est
    addDoor(36, 30, 'vertical', 'key_crypt_skull');   // Est-Nord-Est
    addDoor(28, 34, 'vertical', 'key_crypt_skull');   // Ouest-Sud-Ouest
    addDoor(28, 30, 'vertical', 'key_crypt_skull');   // Ouest-Nord-Ouest

    // =========================================================================
    // ÉTAPE 2 : ZONE 2 - ANNEAU PARTAGÉ (Chambres & Chicanes) [8 <= r <= 18]
    // =========================================================================
    // 6 Vestibules d'accès aux herses de secteur (Entry Halls) avec piliers brise-vue
    const entryVestibules = [
      { cx: 46, cy: 41 }, // s=0
      { cx: 32, cy: 48 }, // s=1
      { cx: 18, cy: 41 }, // s=2
      { cx: 18, cy: 23 }, // s=3
      { cx: 32, cy: 16 }, // s=4
      { cx: 46, cy: 23 }, // s=5
    ];
    for (const v of entryVestibules) {
      carveRoom(v.cx, v.cy, 1, 1, TILE_TYPE.GROUND_1);
      grid[v.cy][v.cx] = TILE_TYPE.WALL_1; // Pilier central pour briser la visée
    }

    // 6 Bastions de Carrefour (Nexus Chambers)
    const nexusChambers = [
      { cx: 44, cy: 32 }, // Est (k=0)
      { cx: 39, cy: 44 }, // Sud-Est (k=1)
      { cx: 25, cy: 44 }, // Sud-Ouest (k=2)
      { cx: 20, cy: 32 }, // Ouest (k=3)
      { cx: 25, cy: 20 }, // Nord-Ouest (k=4)
      { cx: 39, cy: 20 }, // Nord-Est (k=5)
    ];
    for (const n of nexusChambers) {
      carveRoom(n.cx, n.cy, 1, 1, TILE_TYPE.GROUND_1);
      grid[n.cy][n.cx] = TILE_TYPE.WALL_1; // Pilier central
    }

    // Connexions Nexus <-> Vestibules d'entrée avec entrées asymétriques pour briser tout alignement
    // s=1 (32, 48) -> SE Nexus (39, 44) & SW Nexus (25, 44)
    carveOrthogonal(33, 49, 35, 49);
    carveOrthogonal(35, 49, 35, 45);
    carveOrthogonal(35, 45, 38, 45);

    carveOrthogonal(31, 49, 29, 49);
    carveOrthogonal(29, 49, 29, 45);
    carveOrthogonal(29, 45, 26, 45);

    // s=4 (32, 16) -> NE Nexus (39, 20) & NW Nexus (25, 20)
    carveOrthogonal(33, 15, 35, 15);
    carveOrthogonal(35, 15, 35, 19);
    carveOrthogonal(35, 19, 38, 19);

    carveOrthogonal(31, 15, 29, 15);
    carveOrthogonal(29, 15, 29, 19);
    carveOrthogonal(29, 19, 26, 19);

    // s=0 (46, 41) -> SE Nexus (39, 44) & E Nexus (44, 32) avec chicanes
    carveOrthogonal(47, 42, 47, 43);
    carveOrthogonal(47, 43, 44, 43);
    carveOrthogonal(44, 43, 44, 42);
    carveOrthogonal(44, 42, 40, 42);
    carveOrthogonal(40, 42, 40, 43);

    carveOrthogonal(47, 40, 47, 36);
    carveOrthogonal(47, 36, 44, 36);
    carveOrthogonal(44, 36, 44, 33);

    // s=5 (46, 23) -> NE Nexus (39, 20) & E Nexus (44, 32) avec chicanes
    carveOrthogonal(47, 22, 47, 21);
    carveOrthogonal(47, 21, 44, 21);
    carveOrthogonal(44, 21, 44, 22);
    carveOrthogonal(44, 22, 40, 22);
    carveOrthogonal(40, 22, 40, 21);

    carveOrthogonal(47, 24, 47, 28);
    carveOrthogonal(47, 28, 44, 28);
    carveOrthogonal(44, 28, 44, 31);

    // s=2 (18, 41) -> SW Nexus (25, 44) & W Nexus (20, 32) avec chicanes
    carveOrthogonal(17, 42, 17, 43);
    carveOrthogonal(17, 43, 20, 43);
    carveOrthogonal(20, 43, 20, 42);
    carveOrthogonal(20, 42, 24, 42);
    carveOrthogonal(24, 42, 24, 43);

    carveOrthogonal(17, 40, 17, 36);
    carveOrthogonal(17, 36, 20, 36);
    carveOrthogonal(20, 36, 20, 33);

    // s=3 (18, 23) -> NW Nexus (25, 20) & W Nexus (20, 32) avec chicanes
    carveOrthogonal(17, 22, 17, 21);
    carveOrthogonal(17, 21, 20, 21);
    carveOrthogonal(20, 21, 20, 22);
    carveOrthogonal(20, 22, 24, 22);
    carveOrthogonal(24, 22, 24, 21);

    carveOrthogonal(17, 24, 17, 28);
    carveOrthogonal(17, 28, 20, 28);
    carveOrthogonal(20, 28, 20, 31);

    // Chicanes d'accès aux 6 portes du Sanctuaire (segments courts <= 3 cases)
    // S Sanctum Door at (32, 37)
    carveOrthogonal(32, 38, 33, 38);
    carveOrthogonal(33, 38, 33, 41);
    carveOrthogonal(33, 41, 31, 41);
    carveOrthogonal(31, 41, 31, 44);
    carveOrthogonal(31, 44, 33, 44);
    carveOrthogonal(33, 44, 33, 47);

    // N Sanctum Door at (32, 27)
    carveOrthogonal(32, 26, 33, 26);
    carveOrthogonal(33, 26, 33, 23);
    carveOrthogonal(33, 23, 31, 23);
    carveOrthogonal(31, 23, 31, 20);
    carveOrthogonal(31, 20, 33, 20);
    carveOrthogonal(33, 20, 33, 17);

    // ESE Sanctum Door at (36, 34)
    carveOrthogonal(37, 34, 37, 36);
    carveOrthogonal(37, 36, 40, 36);
    carveOrthogonal(40, 36, 40, 38);
    carveOrthogonal(40, 38, 43, 38);
    carveOrthogonal(43, 38, 43, 41);
    carveOrthogonal(43, 41, 45, 41);

    // ENE Sanctum Door at (36, 30)
    carveOrthogonal(37, 30, 37, 28);
    carveOrthogonal(37, 28, 40, 28);
    carveOrthogonal(40, 28, 40, 26);
    carveOrthogonal(40, 26, 43, 26);
    carveOrthogonal(43, 26, 43, 23);
    carveOrthogonal(43, 23, 45, 23);

    // WSW Sanctum Door at (28, 34)
    carveOrthogonal(27, 34, 27, 36);
    carveOrthogonal(27, 36, 24, 36);
    carveOrthogonal(24, 36, 24, 38);
    carveOrthogonal(24, 38, 21, 38);
    carveOrthogonal(21, 38, 21, 41);
    carveOrthogonal(21, 41, 19, 41);

    // WNW Sanctum Door at (28, 30)
    carveOrthogonal(27, 30, 27, 28);
    carveOrthogonal(27, 28, 24, 28);
    carveOrthogonal(24, 28, 24, 26);
    carveOrthogonal(24, 26, 21, 26);
    carveOrthogonal(21, 26, 21, 23);
    carveOrthogonal(21, 23, 19, 23);

    // Monstres d'élite gardant les Nexus de la Zone 2 (Squelettes Archers remplaçant le blob violet)
    const eliteSpots = [
      { x: 44.5, y: 31.5 },
      { x: 39.5, y: 43.5 },
      { x: 25.5, y: 43.5 },
      { x: 20.5, y: 31.5 },
      { x: 25.5, y: 21.5 },
      { x: 39.5, y: 21.5 },
    ];
    for (const espot of eliteSpots) {
      enemies.push({ typeId: 'skeleton_archer', x: espot.x, y: espot.y });
    }

    // Monstres normaux en patrouille dans Zone 2
    const zone2Patrols = [
      { x: 35.5, y: 47.5 },
      { x: 29.5, y: 47.5 },
      { x: 35.5, y: 17.5 },
      { x: 29.5, y: 17.5 },
      { x: 44.5, y: 38.5 },
      { x: 20.5, y: 38.5 },
    ];
    for (const pat of zone2Patrols) {
      enemies.push({ typeId: 'blob', x: pat.x, y: pat.y });
    }

    // Citrouilles ensorcelées hantant les couloirs de la Zone 2
    const pumpkinSpots = [
      { x: 44.5, y: 25.5 },
      { x: 20.5, y: 25.5 },
      { x: 32.5, y: 44.5 },
    ];
    for (const pspot of pumpkinSpots) {
      enemies.push({ typeId: 'pumpkin', x: pspot.x, y: pspot.y });
    }

    // Gobelins au Trésor en vadrouille dans les couloirs de la Zone 2
    const goblinSpots = [
      { x: 32.5, y: 46.5 },
      { x: 32.5, y: 17.5 },
    ];
    for (const gspot of goblinSpots) {
      enemies.push({ typeId: 'goblin', x: gspot.x, y: gspot.y });
    }

    // 3 Portails d'extraction de Zone 2 (activations progressives)
    extractions.push({
      x: 44.5,
      y: 33.5,
      name: "Portail de l'Aura Sépulcrale",
      activationDelaySec: 30,
    });
    extractions.push({
      x: 25.5,
      y: 45.5,
      name: 'Portail des Catacombes Oubliées',
      activationDelaySec: 50,
    });
    extractions.push({
      x: 39.5,
      y: 19.5,
      name: 'Portail du Brasier Éthéré',
      activationDelaySec: 70,
    });

    // 12 Coffres de Zone 2 (dont 3 clés de sanctum garanties)
    const zone2ChestPositions = [
      { x: 45, y: 32 },
      { x: 43, y: 32 },
      { x: 40, y: 44 },
      { x: 38, y: 44 },
      { x: 26, y: 44 },
      { x: 24, y: 44 },
      { x: 21, y: 32 },
      { x: 19, y: 32 },
      { x: 26, y: 20 },
      { x: 24, y: 20 },
      { x: 40, y: 20 },
      { x: 38, y: 20 },
    ];

    const poolItems = ItemDatabase.getChestLootPool();

    // Mélange des coffres pour une répartition généreuse des clés du sanctuaire (au moins 6 sur 12)
    const shuffledChestSpots = [...zone2ChestPositions].sort(
      () => Math.random() - 0.5
    );

    shuffledChestSpots.forEach((pos, idx) => {
      grid[pos.y][pos.x] = TILE_TYPE.CHEST;
      const loots: string[] = [];
      if (idx < 6) {
        loots.push('key_crypt_skull');
      }
      const item1 =
        poolItems[(idx * 2) % poolItems.length]?.id ??
        'hat_myopic_necromancer';
      const item2 =
        poolItems[(idx * 2 + 1) % poolItems.length]?.id ??
        'armor_moldy_hermit_rags';
      loots.push(item1, item2);
      chestLoots[`${pos.x},${pos.y}`] = loots;
    });

    // =========================================================================
    // ÉTAPE 3 : ZONE 1 - LES 6 QUARTIERS DE DÉPART (Labyrinthes Catacombes)
    // =========================================================================

    // A. Construction d'un secteur vertical (s=1 South, s=4 North)
    const buildVerticalSector = (isNorth: boolean): void => {
      const ym = (y: number): number => (isNorth ? size - 1 - y : y);
      const doorY = ym(50);
      addDoor(32, doorY, 'horizontal', 'key_spawn_rusty');

      carve(32, ym(51));
      grid[ym(52)][32] = TILE_TYPE.WALL_1; // Brise-vue face à la herse

      // Vestibule en L
      carve(31, ym(51));
      carve(31, ym(52));
      carve(31, ym(53));

      // Chicane vers Antichambre
      carveOrthogonal(31, ym(53), 33, ym(53));
      carveOrthogonal(33, ym(53), 33, ym(55));
      carveOrthogonal(33, ym(55), 32, ym(55));
      carveOrthogonal(32, ym(55), 32, ym(56));

      // Antichambre (3x3 à ym(57) avec pilier central brise-vue)
      carveRoom(32, ym(57), 1, 1);
      grid[ym(57)][32] = TILE_TYPE.WALL_1;

      // Aile Est : Crypte de la Clé (décalée en ym(58))
      carveOrthogonal(33, ym(58), 35, ym(58));
      carveRoom(37, ym(58), 1, 1);
      grid[ym(58)][38] = TILE_TYPE.CHEST;
      chestLoots[`38,${ym(58)}`] = [
        'key_spawn_rusty',
        'weapon_splintered_apprentice_wand',
      ];
      enemies.push({ typeId: 'blob', x: 37.5, y: ym(58) + 0.5 });

      // Aile Ouest : Armurerie (décalée en ym(56))
      carveOrthogonal(31, ym(56), 29, ym(56));
      carveRoom(27, ym(56), 1, 1);
      grid[ym(56)][26] = TILE_TYPE.CHEST;
      chestLoots[`26,${ym(56)}`] = ['armor_tattered_gambeson'];

      // Crypte de Réveil (Sud) : chambre fermée
      carveRoom(28, ym(61), 1, 1);
      grid[ym(60)][27] = TILE_TYPE.WALL_1;
      grid[ym(60)][28] = TILE_TYPE.WALL_1;
      grid[ym(60)][29] = TILE_TYPE.WALL_1;

      // Corridor d'accès avec chicane brisant toute ligne de mire
      carveOrthogonal(31, ym(58), 31, ym(60));
      carveOrthogonal(31, ym(60), 29, ym(60));
      carve(29, ym(61)); // Entrée unique de la crypte

      playerSpawns.push({
        x: 28.5,
        y: ym(61) + 0.5,
        angle: isNorth ? Math.PI / 2 : (3 * Math.PI) / 2,
      });
    };

    // B. Construction d'un secteur diagonal (s=0, 5, 2, 3)
    const buildDiagonalSector = (mirrorX: boolean, mirrorY: boolean): void => {
      const xm = (x: number): number => (mirrorX ? size - 1 - x : x);
      const ym = (y: number): number => (mirrorY ? size - 1 - y : y);

      const doorX = xm(48);
      const doorY = ym(41);
      addDoor(doorX, doorY, 'vertical', 'key_spawn_rusty');

      carve(xm(49), ym(41));
      grid[ym(41)][xm(50)] = TILE_TYPE.WALL_1; // Brise-vue face à la herse

      carve(xm(49), ym(42));
      carve(xm(50), ym(42));

      // Chicane vers Antichambre
      carveOrthogonal(xm(50), ym(42), xm(52), ym(42));
      carveOrthogonal(xm(52), ym(42), xm(52), ym(44));

      // Antichambre (3x3 à xm(54), ym(45) avec pilier central)
      carveRoom(xm(54), ym(45), 1, 1);
      grid[ym(45)][xm(54)] = TILE_TYPE.WALL_1;

      // Aile Clé (décalée au Nord en ym(43))
      carveOrthogonal(xm(54), ym(44), xm(54), ym(43));
      carveOrthogonal(xm(54), ym(43), xm(56), ym(43));
      carveRoom(xm(57), ym(43), 1, 1);
      const keyChestX = xm(58);
      const keyChestY = ym(43);
      grid[keyChestY][keyChestX] = TILE_TYPE.CHEST;
      chestLoots[`${keyChestX},${keyChestY}`] = [
        'key_spawn_rusty',
        'hat_leech_infested_mitre',
      ];
      enemies.push({ typeId: 'blob', x: xm(57) + 0.5, y: ym(43) + 0.5 });

      // Aile Armurerie (décalée à l'Ouest en ym(46))
      carveOrthogonal(xm(53), ym(46), xm(51), ym(46));
      carveRoom(xm(50), ym(46), 1, 1);
      const armChestX = xm(49);
      const armChestY = ym(46);
      grid[armChestY][armChestX] = TILE_TYPE.CHEST;
      chestLoots[`${armChestX},${armChestY}`] = [
        'boots_cobbled_grave_treaders',
      ];

      // Crypte de Réveil (fermée avec chicane)
      carveRoom(xm(55), ym(49), 1, 1);
      grid[ym(48)][xm(54)] = TILE_TYPE.WALL_1;
      grid[ym(48)][xm(55)] = TILE_TYPE.WALL_1;
      grid[ym(48)][xm(56)] = TILE_TYPE.WALL_1;

      // Entrée latérale
      carveOrthogonal(xm(54), ym(46), xm(54), ym(47));
      carveOrthogonal(xm(54), ym(47), xm(56), ym(47));
      carve(xm(56), ym(48));
      carve(xm(56), ym(49));

      const spawnAngle = Math.atan2(center - ym(49), center - xm(55));
      playerSpawns.push({
        x: xm(55) + 0.5,
        y: ym(49) + 0.5,
        angle: spawnAngle,
      });
    };

    // Construction des 6 secteurs
    buildVerticalSector(false); // Secteur 1 (Sud)
    buildVerticalSector(true);  // Secteur 4 (Nord)

    buildDiagonalSector(false, false); // Secteur 0 (Est-Sud-Est)
    buildDiagonalSector(false, true);  // Secteur 5 (Est-Nord-Est)
    buildDiagonalSector(true, false);  // Secteur 2 (Ouest-Sud-Ouest)
    buildDiagonalSector(true, true);   // Secteur 3 (Ouest-Nord-Ouest)

    // =========================================================================
    // ÉTAPE 4 : SCELLAGE DU PÉRIMÈTRE EXTÉRIEUR (r >= 30)
    // =========================================================================
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - center, y - center);
        if (
          r >= 30.0 ||
          x === 0 ||
          y === 0 ||
          x === size - 1 ||
          y === size - 1
        ) {
          grid[y][x] = TILE_TYPE.WALL_1;
        }
      }
    }

    // =========================================================================
    // ÉTAPE 5 : SÉLECTION DU POINT DE SPAWN JOUEUR INITIAL
    // =========================================================================
    const initialSpawnIndex = Math.floor(Math.random() * playerSpawns.length);
    const chosenSpawn = playerSpawns[initialSpawnIndex] ?? {
      x: 28.5,
      y: 61.5,
      angle: (3 * Math.PI) / 2,
    };

    // =========================================================================
    // ÉTAPE 6 : APPARITION RARE DE L'HOMONCULUS SUR LA CARTE (HORS COFFRES)
    // =========================================================================
    const candidateSpawns: Array<{ x: number; y: number }> = [];
    for (let y = 6; y < size - 6; y++) {
      for (let x = 6; x < size - 6; x++) {
        if (grid[y][x] === TILE_TYPE.GROUND_1) {
          const r = Math.hypot(x - center, y - center);
          if (r >= 12 && r <= 24) {
            const isDoor = doors.some((d) => d.x === x && d.y === y);
            const isChest = grid[y][x] === TILE_TYPE.CHEST;
            const isPlayer = playerSpawns.some(
              (p) => Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5)) < 2.5
            );
            const isExtraction = extractions.some(
              (e) => Math.hypot(e.x - (x + 0.5), e.y - (y + 0.5)) < 2.5
            );
            if (!isDoor && !isChest && !isPlayer && !isExtraction) {
              candidateSpawns.push({ x, y });
            }
          }
        }
      }
    }

    if (candidateSpawns.length > 0) {
      const chosen =
        candidateSpawns[Math.floor(Math.random() * candidateSpawns.length)];
      sprites.push({
        x: chosen.x + 0.5,
        y: chosen.y + 0.5,
        textureId: TILE_TYPE.HOMONCULUS,
        scale: 0.42,
        itemId: 'offhand_homonculus',
      });
    }

    // =========================================================================
    // ÉTAPE 7 : APPARITION DES MARCHANDS (ZONE 2 ET ZONE 3)
    // =========================================================================
    // 1. Marchand en Zone 3 (Sanctuaire central dans une alcôve royale)
    const zone3MerchantPos = { x: center - 3, y: center - 2 };
    sprites.push({
      x: zone3MerchantPos.x + 0.5,
      y: zone3MerchantPos.y + 0.5,
      textureId: TILE_TYPE.MERCHANT,
      scale: 0.72,
    });

    // 2. Marchand en Zone 2 (Anneau intermédiaire des catacombes)
    const z2Candidates: Array<{ x: number; y: number }> = [];
    for (let y = 8; y < size - 8; y++) {
      for (let x = 8; x < size - 8; x++) {
        if (grid[y][x] === TILE_TYPE.GROUND_1) {
          const r = Math.hypot(x - center, y - center);
          if (r >= 13 && r <= 22) {
            const isDoor = doors.some((d) => d.x === x && d.y === y);
            const isChest = grid[y][x] === TILE_TYPE.CHEST;
            const isSprite = sprites.some(
              (s) => Math.hypot(s.x - (x + 0.5), s.y - (y + 0.5)) < 2.5
            );
            const isPlayer = playerSpawns.some(
              (p) => Math.hypot(p.x - (x + 0.5), p.y - (y + 0.5)) < 2.5
            );
            const isExtraction = extractions.some(
              (e) => Math.hypot(e.x - (x + 0.5), e.y - (y + 0.5)) < 2.5
            );
            if (!isDoor && !isChest && !isSprite && !isPlayer && !isExtraction) {
              z2Candidates.push({ x, y });
            }
          }
        }
      }
    }

    if (z2Candidates.length > 0) {
      const chosenZ2 = z2Candidates[Math.floor(Math.random() * z2Candidates.length)];
      sprites.push({
        x: chosenZ2.x + 0.5,
        y: chosenZ2.y + 0.5,
        textureId: TILE_TYPE.MERCHANT,
        scale: 0.72,
      });
    }

    return {
      name: `Donjon d'Extraction (Session #${Math.floor(1000 + Math.random() * 9000)})`,
      grid,
      floorGrid,
      skyTileId: TILE_TYPE.SKY_1,
      chestLoots,
      enemies,
      doors,
      extractions,
      sprites,
      playerSpawns: playerSpawns.map((s) => ({ x: s.x, y: s.y })),
      playerSpawn: {
        x: chosenSpawn.x,
        y: chosenSpawn.y,
        angle: chosenSpawn.angle,
      },
    };
  }
}
