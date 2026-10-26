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

interface ChunkEnemy {
  typeId: string;
  x: number; // 0 à 10
  y: number; // 0 à 10
}

interface ChunkChest {
  x: number;
  y: number;
  tier?: 'starter' | 'standard' | 'high' | 'royal';
  fixedLoot?: string[];
}

interface ChunkPortal {
  x: number;
  y: number;
  name: string;
  delaySec: number;
}

interface ChunkSprite {
  x: number;
  y: number;
  textureId: number;
  scale?: number;
  itemId?: string;
}

interface ModuleTemplate {
  id: string;
  grid: string[]; // 11 lignes de 11 caractères
  enemies?: ChunkEnemy[];
  chests?: ChunkChest[];
  portals?: ChunkPortal[];
  sprites?: ChunkSprite[];
  spawnPoint?: { x: number; y: number; angle: number };
}

/**
 * GÉNÉRATEUR PROCÉDURAL MODULAIRE DE CITADELLE 71×71 (APPROCHE 2 : SALLES PRÉFABRIQUÉES INTERCONNECTÉES)
 *
 * Équilibrage & Pacing :
 * - Grille de 7×7 modules de 11×11 cases (taille totale 71×71 cases).
 * - Centre (3, 3) : Sanctuaire Royal du Boss (Zone 3), scellé par 4 Portes à Crâne d'Os.
 * - Les 4 coins (0,0), (6,0), (0,6), (6,6) : Cryptes d'éveil des joueurs (Zone 1).
 * - Les 44 autres modules : Vaste réseau de catacombes (Zone 2) connecté par un arbre couvrant
 *   aléatoire avec boucles de circulation, garantissant 100% d'accessibilité.
 * - Durée calibrée : ~4-5 min pour atteindre la première extraction tactique, ~12-15 min pour le boss.
 */
export class MapGenerator {
  public static readonly DEFAULT_SIZE = 71;
  public static readonly CHUNK_SIZE = 11;
  public static readonly CHUNK_STEP = 10;
  public static readonly GRID_CHUNKS = 7;

  // =========================================================================
  // CATALOGUE DES SALLES PRÉFABRIQUÉES (11×11)
  // # = Mur, . = Sol 1, * = Sol 2 (orné/runique), D = Emplacement de passage
  // =========================================================================

  private static readonly STARTING_CRYPT: ModuleTemplate = {
    id: 'starting_crypt',
    grid: [
      '###########',
      '#..#......#',
      '#..#......#',
      '#..#.####.#',
      '#....#....#',
      'D.####.K..#',
      '#....#....#',
      '#....####.#',
      '#.S.......#',
      '#.........#',
      '###########',
    ],
    enemies: [{ typeId: 'blob', x: 7.5, y: 5.5 }],
    chests: [
      { x: 7, y: 2, tier: 'starter' },
      { x: 7, y: 5, fixedLoot: ['key_spawn_rusty'] },
    ],
    spawnPoint: { x: 2.5, y: 8.5, angle: -Math.PI / 2 },
  };

  private static readonly BOSS_SANCTUM: ModuleTemplate = {
    id: 'boss_sanctum',
    grid: [
      '###########',
      '#.*.....*.#',
      '#.##...##.#',
      '#.........#',
      '#....*....#',
      'D..*****..D',
      '#....*....#',
      '#.........#',
      '#.##...##.#',
      '#.*.....*.#',
      '###########',
    ],
    chests: [
      { x: 2, y: 5, tier: 'royal' },
      { x: 8, y: 5, tier: 'royal' },
    ],
    portals: [
      {
        x: 5.5,
        y: 3.5,
        name: 'Portail Royal du Sanctuaire',
        delaySec: 90,
      },
    ],
  };

  private static readonly ARENA_COLOSSEUM: ModuleTemplate = {
    id: 'arena_colosseum',
    grid: [
      '###########',
      '#.........#',
      '#..##.##..#',
      '#..##.##..#',
      '#.........#',
      'D....*....D',
      '#.........#',
      '#..##.##..#',
      '#..##.##..#',
      '#.........#',
      '###########',
    ],
    enemies: [
      { typeId: 'skeleton_archer', x: 2.5, y: 2.5 },
      { typeId: 'blob', x: 5.5, y: 5.5 },
      { typeId: 'blob', x: 8.5, y: 8.5 },
    ],
    chests: [{ x: 5, y: 1, tier: 'standard' }],
  };

  private static readonly ARENA_CROSSFIRE: ModuleTemplate = {
    id: 'arena_crossfire',
    grid: [
      '###########',
      '#...#.#...#',
      '#...#.#...#',
      '#..#...#..#',
      '###.....###',
      'D....*....D',
      '###.....###',
      '#..#...#..#',
      '#...#.#...#',
      '#...#.#...#',
      '###########',
    ],
    enemies: [
      { typeId: 'skeleton_archer', x: 2.5, y: 2.5 },
      { typeId: 'skeleton_archer', x: 8.5, y: 8.5 },
      { typeId: 'goblin', x: 5.5, y: 5.5 },
    ],
    chests: [{ x: 5, y: 9, tier: 'standard' }],
  };

  private static readonly ARENA_PUMPKIN: ModuleTemplate = {
    id: 'arena_pumpkin',
    grid: [
      '###########',
      '#...***...#',
      '#.*.***.*.#',
      '#***...***#',
      '#***...***#',
      'D....*....D',
      '#***...***#',
      '#***...***#',
      '#.*.***.*.#',
      '#...***...#',
      '###########',
    ],
    enemies: [
      { typeId: 'pumpkin', x: 3.5, y: 3.5 },
      { typeId: 'pumpkin', x: 7.5, y: 7.5 },
      { typeId: 'blob', x: 5.5, y: 5.5 },
    ],
    chests: [{ x: 1, y: 1, tier: 'standard' }],
  };

  private static readonly ARENA_LABYRINTH: ModuleTemplate = {
    id: 'arena_labyrinth',
    grid: [
      '###########',
      '#.....#...#',
      '#.###.#.#.#',
      '#.#.....#.#',
      '#.#.###.#.#',
      'D.#...#...D',
      '#.#.###.#.#',
      '#.#.....#.#',
      '#.###.#.#.#',
      '#.....#...#',
      '###########',
    ],
    enemies: [
      { typeId: 'blob', x: 2.5, y: 2.5 },
      { typeId: 'skeleton_archer', x: 8.5, y: 2.5 },
      { typeId: 'blob', x: 2.5, y: 8.5 },
    ],
    chests: [{ x: 8, y: 8, tier: 'standard' }],
  };

  private static readonly ARENA_AMBUSH: ModuleTemplate = {
    id: 'arena_ambush',
    grid: [
      '###########',
      '#..#...#..#',
      '#..#...#..#',
      '#.........#',
      '#..#####..#',
      'D..#***#..D',
      '#..#####..#',
      '#.........#',
      '#..#...#..#',
      '#..#...#..#',
      '###########',
    ],
    enemies: [
      { typeId: 'blob', x: 2.5, y: 5.5 },
      { typeId: 'blob', x: 8.5, y: 5.5 },
      { typeId: 'pumpkin', x: 5.5, y: 8.5 },
    ],
    chests: [{ x: 5, y: 5, tier: 'high' }],
  };

  private static readonly TREASURE_VAULT: ModuleTemplate = {
    id: 'treasure_vault',
    grid: [
      '###########',
      '#.........#',
      '#..#...#..#',
      '#..#***#..#',
      '#..#***#..#',
      'D....*....D',
      '#..#***#..#',
      '#..#***#..#',
      '#..#...#..#',
      '#.........#',
      '###########',
    ],
    enemies: [
      { typeId: 'skeleton_archer', x: 5.5, y: 5.5 },
      { typeId: 'blob', x: 2.5, y: 2.5 },
    ],
    chests: [
      { x: 5, y: 3, tier: 'high', fixedLoot: ['key_crypt_skull'] },
      { x: 5, y: 7, tier: 'standard' },
    ],
  };

  private static readonly TREASURE_SHRINE: ModuleTemplate = {
    id: 'treasure_shrine',
    grid: [
      '###########',
      '#...#.#...#',
      '#..##.##..#',
      '#...#.#...#',
      '##.......##',
      'D...***...D',
      '##.......##',
      '#...#.#...#',
      '#..##.##..#',
      '#...#.#...#',
      '###########',
    ],
    enemies: [
      { typeId: 'skeleton_archer', x: 5.5, y: 2.5 },
      { typeId: 'pumpkin', x: 5.5, y: 8.5 },
    ],
    chests: [{ x: 5, y: 5, tier: 'high', fixedLoot: ['key_crypt_skull'] }],
  };

  private static readonly EXTRACTION_SANCTUM: ModuleTemplate = {
    id: 'extraction_sanctum',
    grid: [
      '###########',
      '#..#...#..#',
      '#.***.***.#',
      '#.*******.#',
      '#..*****..#',
      'D...***...D',
      '#..*****..#',
      '#.*******.#',
      '#.***.***.#',
      '#..#...#..#',
      '###########',
    ],
    enemies: [{ typeId: 'blob', x: 5.5, y: 3.5 }],
    chests: [{ x: 1, y: 5, tier: 'standard' }],
    portals: [
      {
        x: 5.5,
        y: 5.5,
        name: 'Portail des Âmes Sépulcrales',
        delaySec: 45,
      },
    ],
  };

  private static readonly MERCHANT_BAZAAR: ModuleTemplate = {
    id: 'merchant_bazaar',
    grid: [
      '###########',
      '#.........#',
      '#..#####..#',
      '#..#***#..#',
      '#..#***#..#',
      'D....*....D',
      '#..#####..#',
      '#.........#',
      '#.........#',
      '#.........#',
      '###########',
    ],
    sprites: [
      {
        x: 5.5,
        y: 3.5,
        textureId: TILE_TYPE.MERCHANT,
        scale: 0.72,
      },
    ],
    chests: [{ x: 8, y: 8, tier: 'standard' }],
  };

  private static readonly HOMONCULUS_SANCTUARY: ModuleTemplate = {
    id: 'homonculus_sanctuary',
    grid: [
      '###########',
      '#...#.#...#',
      '#...*.*...#',
      '#..#***#..#',
      '#...*.*...#',
      'D....*....D',
      '#...*.*...#',
      '#..#***#..#',
      '#...*.*...#',
      '#...#.#...#',
      '###########',
    ],
    enemies: [
      { typeId: 'goblin', x: 3.5, y: 5.5 },
      { typeId: 'blob', x: 7.5, y: 5.5 },
    ],
    sprites: [
      {
        x: 5.5,
        y: 5.5,
        textureId: TILE_TYPE.HOMONCULUS,
        scale: 0.42,
        itemId: 'offhand_homonculus',
      },
    ],
    chests: [{ x: 8, y: 2, tier: 'standard' }],
  };

  private static readonly CROSSROAD_GRAND: ModuleTemplate = {
    id: 'crossroad_grand',
    grid: [
      '###########',
      '#....#....#',
      '#.##.#.##.#',
      '#.#.....#.#',
      '#.#.###.#.#',
      'D.........D',
      '#.#.###.#.#',
      '#.#.....#.#',
      '#.##.#.##.#',
      '#....#....#',
      '###########',
    ],
    enemies: [{ typeId: 'blob', x: 5.5, y: 5.5 }],
    chests: [{ x: 5, y: 2, tier: 'standard' }],
  };

  private static readonly CORRIDOR_CHICANE: ModuleTemplate = {
    id: 'corridor_chicane',
    grid: [
      '###########',
      '#....#....#',
      '#....#....#',
      '#.####....#',
      '#.#.......#',
      'D.#...#####',
      '#.#.......#',
      '#.####....#',
      '#....#....#',
      '#....#....#',
      '###########',
    ],
    enemies: [{ typeId: 'blob', x: 7.5, y: 4.5 }],
    chests: [{ x: 2, y: 2, tier: 'standard' }],
  };

  // =========================================================================
  // MÉTHODE PRINCIPALE DE GÉNÉRATION (71×71)
  // =========================================================================

  public static generate(_options: MapGeneratorOptions = {}): LevelData {
    const size = MapGenerator.DEFAULT_SIZE; // 71

    // Initialisation de la grille 71×71 entièrement remplie de murs
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

    // 1. Définition des coordonnées des 44 nœuds de Zone 2 (grille 7×7)
    const zone2Coords: Array<[number, number]> = [];
    for (let cy = 0; cy < MapGenerator.GRID_CHUNKS; cy++) {
      for (let cx = 0; cx < MapGenerator.GRID_CHUNKS; cx++) {
        // Exclure le centre (3,3) et les 4 coins de spawn
        const isCenter = cx === 3 && cy === 3;
        const isCorner =
          (cx === 0 || cx === 6) && (cy === 0 || cy === 6);
        if (!isCenter && !isCorner) {
          zone2Coords.push([cx, cy]);
        }
      }
    }

    // 2. Génération d'un arbre couvrant aléatoire avec boucles pour les 44 nœuds de Zone 2
    const openConnections = new Set<string>();

    const makeConnKey = (
      c1x: number,
      c1y: number,
      c2x: number,
      c2y: number
    ): string => {
      if (c1x < c2x || (c1x === c2x && c1y < c2y)) {
        return `${c1x},${c1y}-${c2x},${c2y}`;
      }
      return `${c2x},${c2y}-${c1x},${c1y}`;
    };

    // Algorithme de Prim pour l'arbre couvrant de Zone 2
    const visited = new Set<string>();
    const startZ2 = zone2Coords[Math.floor(Math.random() * zone2Coords.length)];
    visited.add(`${startZ2[0]},${startZ2[1]}`);

    const candidateEdges: Array<{
      from: [number, number];
      to: [number, number];
    }> = [];

    const addAdjacentEdges = (cx: number, cy: number) => {
      const dirs = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const isZ2 = zone2Coords.some(([zx, zy]) => zx === nx && zy === ny);
        if (isZ2 && !visited.has(`${nx},${ny}`)) {
          candidateEdges.push({ from: [cx, cy], to: [nx, ny] });
        }
      }
    };

    addAdjacentEdges(startZ2[0], startZ2[1]);

    while (visited.size < zone2Coords.length && candidateEdges.length > 0) {
      const randIdx = Math.floor(Math.random() * candidateEdges.length);
      const edge = candidateEdges.splice(randIdx, 1)[0];
      const toKey = `${edge.to[0]},${edge.to[1]}`;

      if (!visited.has(toKey)) {
        visited.add(toKey);
        openConnections.add(
          makeConnKey(edge.from[0], edge.from[1], edge.to[0], edge.to[1])
        );
        addAdjacentEdges(edge.to[0], edge.to[1]);
      }
    }

    // Ajout de 16 boucles aléatoires supplémentaires dans Zone 2 pour un réseau de circulation ouvert
    let addedLoops = 0;
    const allPossibleZ2Edges: Array<{
      from: [number, number];
      to: [number, number];
    }> = [];

    for (let i = 0; i < zone2Coords.length; i++) {
      const [ax, ay] = zone2Coords[i];
      const dirs = [
        [1, 0],
        [0, 1],
      ];
      for (const [dx, dy] of dirs) {
        const bx = ax + dx;
        const by = ay + dy;
        const isBInZ2 = zone2Coords.some(([zx, zy]) => zx === bx && zy === by);
        if (isBInZ2) {
          const key = makeConnKey(ax, ay, bx, by);
          if (!openConnections.has(key)) {
            allPossibleZ2Edges.push({ from: [ax, ay], to: [bx, by] });
          }
        }
      }
    }

    // Mélanger et piocher des boucles
    for (let i = allPossibleZ2Edges.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPossibleZ2Edges[i], allPossibleZ2Edges[j]] = [
        allPossibleZ2Edges[j],
        allPossibleZ2Edges[i],
      ];
    }
    for (const edge of allPossibleZ2Edges) {
      if (addedLoops >= 16) break;
      openConnections.add(
        makeConnKey(edge.from[0], edge.from[1], edge.to[0], edge.to[1])
      );
      addedLoops++;
    }

    // 3. Connexion des 4 Cryptes de départ aux pièces Zone 2 adjacentes (Portes Rouillées)
    const cornerSpawns: Array<{
      cx: number;
      cy: number;
      connectTo: [number, number];
      rotation: 0 | 1 | 2 | 3;
    }> = [
      { cx: 0, cy: 0, connectTo: [1, 0], rotation: 2 }, // Sortie vers l'Est
      { cx: 6, cy: 0, connectTo: [5, 0], rotation: 0 }, // Sortie vers l'Ouest
      { cx: 0, cy: 6, connectTo: [1, 6], rotation: 2 }, // Sortie vers l'Est
      { cx: 6, cy: 6, connectTo: [5, 6], rotation: 0 }, // Sortie vers l'Ouest
    ];

    for (const corner of cornerSpawns) {
      openConnections.add(
        makeConnKey(corner.cx, corner.cy, corner.connectTo[0], corner.connectTo[1])
      );
    }

    // 4. Connexion du Sanctuaire central (3,3) à ses 4 voisins (Portes à Crâne)
    const sanctumNeighbors: Array<[number, number]> = [
      [3, 2], // Nord
      [3, 4], // Sud
      [2, 3], // Ouest
      [4, 3], // Est
    ];
    for (const n of sanctumNeighbors) {
      openConnections.add(makeConnKey(3, 3, n[0], n[1]));
    }

    // 5. Répartition thématique des 44 pièces de Zone 2 en anneaux concentriques
    // Tri selon la distance au centre (3,3)
    const shuffledZ2 = [...zone2Coords];
    for (let i = shuffledZ2.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledZ2[i], shuffledZ2[j]] = [shuffledZ2[j], shuffledZ2[i]];
    }

    const chunkRoleMap = new Map<string, ModuleTemplate>();

    // A. 2 Marchands (1 dans l'anneau intermédiaire, 1 dans l'anneau profond)
    chunkRoleMap.set(`${shuffledZ2[0][0]},${shuffledZ2[0][1]}`, MapGenerator.MERCHANT_BAZAAR);
    chunkRoleMap.set(`${shuffledZ2[1][0]},${shuffledZ2[1][1]}`, MapGenerator.MERCHANT_BAZAAR);

    // B. 3 Portails d'extraction échelonnés dans le temps (45s, 65s, 85s)
    chunkRoleMap.set(`${shuffledZ2[2][0]},${shuffledZ2[2][1]}`, {
      ...MapGenerator.EXTRACTION_SANCTUM,
      id: 'extraction_sanctum_1',
      portals: [
        {
          x: 5.5,
          y: 5.5,
          name: 'Portail des Catacombes Extérieures',
          delaySec: 45,
        },
      ],
    });

    chunkRoleMap.set(`${shuffledZ2[3][0]},${shuffledZ2[3][1]}`, {
      ...MapGenerator.EXTRACTION_SANCTUM,
      id: 'extraction_sanctum_2',
      portals: [
        {
          x: 5.5,
          y: 5.5,
          name: 'Portail de l\'Aura Sépulcrale',
          delaySec: 65,
        },
      ],
    });

    chunkRoleMap.set(`${shuffledZ2[4][0]},${shuffledZ2[4][1]}`, {
      ...MapGenerator.EXTRACTION_SANCTUM,
      id: 'extraction_sanctum_3',
      portals: [
        {
          x: 5.5,
          y: 5.5,
          name: 'Portail du Brasier Éthéré',
          delaySec: 85,
        },
      ],
    });

    // C. 8 Cryptes et Sanctuaires aux Trésors (garantissant au moins 6 Clés de Crâne dans la citadelle)
    const treasureTemplates = [
      MapGenerator.TREASURE_VAULT,
      MapGenerator.TREASURE_SHRINE,
      MapGenerator.TREASURE_VAULT,
      MapGenerator.TREASURE_SHRINE,
      MapGenerator.TREASURE_VAULT,
      MapGenerator.TREASURE_SHRINE,
      MapGenerator.TREASURE_VAULT,
      MapGenerator.TREASURE_SHRINE,
    ];

    for (let t = 0; t < treasureTemplates.length; t++) {
      chunkRoleMap.set(
        `${shuffledZ2[5 + t][0]},${shuffledZ2[5 + t][1]}`,
        treasureTemplates[t]
      );
    }

    // D. 1 Sanctuaire secret de l'Homonculus
    chunkRoleMap.set(
      `${shuffledZ2[13][0]},${shuffledZ2[13][1]}`,
      MapGenerator.HOMONCULUS_SANCTUARY
    );

    // E. Les 30 autres pièces : Arènes de combat, labyrinthes et carrefours variés
    const combatPool = [
      MapGenerator.ARENA_COLOSSEUM,
      MapGenerator.ARENA_CROSSFIRE,
      MapGenerator.ARENA_PUMPKIN,
      MapGenerator.ARENA_LABYRINTH,
      MapGenerator.ARENA_AMBUSH,
      MapGenerator.CROSSROAD_GRAND,
      MapGenerator.CORRIDOR_CHICANE,
    ];

    for (let i = 14; i < shuffledZ2.length; i++) {
      const template = combatPool[Math.floor(Math.random() * combatPool.length)];
      chunkRoleMap.set(`${shuffledZ2[i][0]},${shuffledZ2[i][1]}`, template);
    }

    // 6. Placement des modules et gravure dans la grille 71×71
    const catalogItems = [...ItemDatabase.getChestLootPool()];
    let itemCursor = 0;

    // A. Placement des 4 cryptes de départ
    for (const corner of cornerSpawns) {
      const rotated = MapGenerator.rotateModule(
        MapGenerator.STARTING_CRYPT,
        corner.rotation
      );
      MapGenerator.stampModule(
        grid,
        floorGrid,
        corner.cx,
        corner.cy,
        rotated,
        enemies,
        sprites,
        extractions,
        chestLoots,
        catalogItems,
        itemCursor
      );
      itemCursor += 2;

      // Calcul du point de réveil du joueur dans cette crypte
      if (rotated.spawnPoint) {
        playerSpawns.push({
          x: corner.cx * MapGenerator.CHUNK_STEP + rotated.spawnPoint.x,
          y: corner.cy * MapGenerator.CHUNK_STEP + rotated.spawnPoint.y,
          angle: rotated.spawnPoint.angle,
        });
      }
    }

    // B. Placement du Sanctuaire du Boss au centre (3,3)
    const bossTemplate = { ...MapGenerator.BOSS_SANCTUM };
    // Choix aléatoire du Boss final
    const bossTypeId = Math.random() < 0.6 ? 'carrot_cake_king' : 'blood_queen';
    bossTemplate.enemies = [
      {
        typeId: bossTypeId,
        x: 5.5,
        y: 6.5,
      },
    ];

    MapGenerator.stampModule(
      grid,
      floorGrid,
      3,
      3,
      bossTemplate,
      enemies,
      sprites,
      extractions,
      chestLoots,
      catalogItems,
      itemCursor
    );
    itemCursor += 2;

    // C. Placement des 44 modules de Zone 2 avec rotations aléatoires (0, 90, 180 ou 270°)
    for (const [cx, cy] of zone2Coords) {
      const template = chunkRoleMap.get(`${cx},${cy}`) ?? MapGenerator.ARENA_COLOSSEUM;
      const rot = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      const rotated = MapGenerator.rotateModule(template, rot);

      MapGenerator.stampModule(
        grid,
        floorGrid,
        cx,
        cy,
        rotated,
        enemies,
        sprites,
        extractions,
        chestLoots,
        catalogItems,
        itemCursor
      );
      itemCursor += 3;
    }

    // 7. Percement des portes et passages entre les modules connectés
    for (let cy = 0; cy < MapGenerator.GRID_CHUNKS; cy++) {
      for (let cx = 0; cx < MapGenerator.GRID_CHUNKS; cx++) {
        // Connexion vers l'Est (cx, cy) -> (cx + 1, cy)
        if (cx < MapGenerator.GRID_CHUNKS - 1) {
          const key = makeConnKey(cx, cy, cx + 1, cy);
          if (openConnections.has(key)) {
            const doorX = cx * MapGenerator.CHUNK_STEP + 10;
            const doorY = cy * MapGenerator.CHUNK_STEP + 5;

            // Déterminer s'il s'agit d'une porte verrouillée
            const isSanctumEntry =
              (cx === 2 && cy === 3) || (cx === 3 && cy === 3);
            const isSpawnExit =
              (cx === 0 && cy === 0) ||
              (cx === 5 && cy === 0) ||
              (cx === 0 && cy === 6) ||
              (cx === 5 && cy === 6);

            if (isSanctumEntry) {
              grid[doorY][doorX] = TILE_TYPE.DOOR;
              doors.push({ x: doorX, y: doorY, requiredKeyId: 'key_crypt_skull' });
            } else if (isSpawnExit) {
              grid[doorY][doorX] = TILE_TYPE.DOOR;
              doors.push({ x: doorX, y: doorY, requiredKeyId: 'key_spawn_rusty' });
            } else {
              grid[doorY][doorX] = TILE_TYPE.GROUND_1;
            }

            // S'assurer que les cases devant et derrière la porte sont ouvertes
            grid[doorY][doorX - 1] = TILE_TYPE.GROUND_1;
            grid[doorY][doorX + 1] = TILE_TYPE.GROUND_1;
          }
        }

        // Connexion vers le Sud (cx, cy) -> (cx, cy + 1)
        if (cy < MapGenerator.GRID_CHUNKS - 1) {
          const key = makeConnKey(cx, cy, cx, cy + 1);
          if (openConnections.has(key)) {
            const doorX = cx * MapGenerator.CHUNK_STEP + 5;
            const doorY = cy * MapGenerator.CHUNK_STEP + 10;

            const isSanctumEntry =
              (cx === 3 && cy === 2) || (cx === 3 && cy === 3);
            const isSpawnExit =
              (cx === 0 && cy === 0) ||
              (cx === 6 && cy === 0) ||
              (cx === 0 && cy === 5) ||
              (cx === 6 && cy === 5);

            if (isSanctumEntry) {
              grid[doorY][doorX] = TILE_TYPE.DOOR;
              doors.push({ x: doorX, y: doorY, requiredKeyId: 'key_crypt_skull' });
            } else if (isSpawnExit) {
              grid[doorY][doorX] = TILE_TYPE.DOOR;
              doors.push({ x: doorX, y: doorY, requiredKeyId: 'key_spawn_rusty' });
            } else {
              grid[doorY][doorX] = TILE_TYPE.GROUND_1;
            }

            // S'assurer que les cases devant et derrière la porte sont ouvertes
            grid[doorY - 1][doorX] = TILE_TYPE.GROUND_1;
            grid[doorY + 1][doorX] = TILE_TYPE.GROUND_1;
          }
        }
      }
    }

    // 8. Fermeture solide du périmètre extérieur de la carte
    for (let x = 0; x < size; x++) {
      grid[0][x] = TILE_TYPE.WALL_1;
      grid[size - 1][x] = TILE_TYPE.WALL_1;
    }
    for (let y = 0; y < size; y++) {
      grid[y][0] = TILE_TYPE.WALL_1;
      grid[y][size - 1] = TILE_TYPE.WALL_1;
    }

    // 9. Sélection du point de réveil du joueur parmi les 4 cryptes
    const chosenSpawn =
      playerSpawns[Math.floor(Math.random() * playerSpawns.length)] ?? {
        x: 2.5,
        y: 8.5,
        angle: -Math.PI / 2,
      };

    return {
      name: `Citadelle Royale 71×71 (Expédition #${Math.floor(1000 + Math.random() * 9000)})`,
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

  // =========================================================================
  // FONCTIONS UTILITAIRES DE TRANSFORMATION DES MODULES
  // =========================================================================

  /**
   * Effectue une rotation de 90° × rotation (0, 1, 2, 3) sur un module 11×11
   */
  private static rotateModule(
    template: ModuleTemplate,
    rotation: 0 | 1 | 2 | 3
  ): ModuleTemplate {
    if (rotation === 0) {
      return template;
    }

    const size = MapGenerator.CHUNK_SIZE; // 11
    const rotCoord = (x: number, y: number): { x: number; y: number } => {
      if (rotation === 1) return { x: size - 1 - y, y: x };
      if (rotation === 2) return { x: size - 1 - x, y: size - 1 - y };
      return { x: y, y: size - 1 - x };
    };

    // Rotation de la grille de caractères
    const newGrid: string[] = [];
    for (let y = 0; y < size; y++) {
      let rowChars = '';
      for (let x = 0; x < size; x++) {
        let ox = x;
        let oy = y;
        if (rotation === 1) {
          ox = y;
          oy = size - 1 - x;
        } else if (rotation === 2) {
          ox = size - 1 - x;
          oy = size - 1 - y;
        } else if (rotation === 3) {
          ox = size - 1 - y;
          oy = x;
        }
        rowChars += template.grid[oy][ox];
      }
      newGrid.push(rowChars);
    }

    // Rotation des ennemis
    const newEnemies = template.enemies?.map((e) => {
      const rc = rotCoord(e.x, e.y);
      return { typeId: e.typeId, x: rc.x, y: rc.y };
    });

    // Rotation des coffres
    const newChests = template.chests?.map((c) => {
      const rc = rotCoord(c.x, c.y);
      return {
        x: Math.round(rc.x),
        y: Math.round(rc.y),
        tier: c.tier,
        fixedLoot: c.fixedLoot,
      };
    });

    // Rotation des portails
    const newPortals = template.portals?.map((p) => {
      const rc = rotCoord(p.x, p.y);
      return { x: rc.x, y: rc.y, name: p.name, delaySec: p.delaySec };
    });

    // Rotation des sprites
    const newSprites = template.sprites?.map((s) => {
      const rc = rotCoord(s.x, s.y);
      return {
        x: rc.x,
        y: rc.y,
        textureId: s.textureId,
        scale: s.scale,
        itemId: s.itemId,
      };
    });

    // Rotation du point de réveil
    let newSpawn = template.spawnPoint;
    if (newSpawn) {
      const rc = rotCoord(newSpawn.x, newSpawn.y);
      newSpawn = {
        x: rc.x,
        y: rc.y,
        angle: (newSpawn.angle + rotation * (Math.PI / 2)) % (Math.PI * 2),
      };
    }

    return {
      id: `${template.id}_rot${rotation}`,
      grid: newGrid,
      enemies: newEnemies,
      chests: newChests,
      portals: newPortals,
      sprites: newSprites,
      spawnPoint: newSpawn,
    };
  }

  /**
   * Estampe un module 11×11 dans la carte globale à l'emplacement de chunk (cx, cy)
   */
  private static stampModule(
    grid: number[][],
    floorGrid: number[][],
    cx: number,
    cy: number,
    module: ModuleTemplate,
    enemies: EnemySpawnData[],
    sprites: SpriteSpawnData[],
    extractions: ExtractionSpawnData[],
    chestLoots: Record<string, string[]>,
    catalogItems: any[],
    itemCursor: number
  ): void {
    const ox = cx * MapGenerator.CHUNK_STEP;
    const oy = cy * MapGenerator.CHUNK_STEP;

    // 1. Décalque de la grille
    for (let ly = 0; ly < MapGenerator.CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < MapGenerator.CHUNK_SIZE; lx++) {
        const char = module.grid[ly][lx];
        const gx = ox + lx;
        const gy = oy + ly;

        if (char === '#') {
          grid[gy][gx] = TILE_TYPE.WALL_1;
        } else if (char === '*') {
          grid[gy][gx] = TILE_TYPE.GROUND_1;
          floorGrid[gy][gx] = TILE_TYPE.GROUND_2;
        } else if (char === '.') {
          grid[gy][gx] = TILE_TYPE.GROUND_1;
          floorGrid[gy][gx] = TILE_TYPE.GROUND_1;
        } else if (char === 'D') {
          // Point de passage potentiel : reste mur par défaut jusqu'au perçage par openConnections
          grid[gy][gx] = TILE_TYPE.WALL_1;
        } else if (char === 'S') {
          grid[gy][gx] = TILE_TYPE.GROUND_1;
        } else if (char === 'K') {
          grid[gy][gx] = TILE_TYPE.CHEST;
        }
      }
    }

    // 2. Ajout des ennemis
    if (module.enemies) {
      for (const e of module.enemies) {
        enemies.push({
          typeId: e.typeId,
          x: ox + e.x,
          y: oy + e.y,
        });
      }
    }

    // 3. Ajout des coffres et génération de leur butin selon leur tier
    if (module.chests) {
      for (let i = 0; i < module.chests.length; i++) {
        const c: ChunkChest = module.chests[i];
        const gx: number = ox + c.x;
        const gy: number = oy + c.y;
        grid[gy][gx] = TILE_TYPE.CHEST;

        const keyCoord = `${gx},${gy}`;
        if (c.fixedLoot) {
          const bonusItem =
            catalogItems[(itemCursor + i) % catalogItems.length]?.id ??
            'armor_moldy_hermit_rags';
          chestLoots[keyCoord] = [...c.fixedLoot, bonusItem];
        } else if (c.tier === 'starter') {
          const starterItems = [
            'weapon_splintered_apprentice_wand',
            'armor_tattered_gambeson',
            'hat_myopic_necromancer',
            'boots_cobbled_grave_treaders',
          ];
          chestLoots[keyCoord] = [
            starterItems[Math.floor(Math.random() * starterItems.length)],
          ];
        } else if (c.tier === 'royal') {
          const royalItems = [
            'weapon_crooked_phylactery_dagger',
            'armor_shrunk_black_mass_robe',
            'weapon_arthritic_lich_staff',
            'armor_cursed_bone_carapace',
          ];
          chestLoots[keyCoord] = [
            royalItems[(itemCursor + i) % royalItems.length],
            royalItems[(itemCursor + i + 1) % royalItems.length],
          ];
        } else {
          // Standard / High tier
          const count = c.tier === 'high' ? 3 : 2;
          const loot: string[] = [];
          for (let k = 0; k < count; k++) {
            const item = catalogItems[(itemCursor + k) % catalogItems.length];
            if (item) loot.push(item.id);
          }
          chestLoots[keyCoord] = loot;
        }
      }
    }

    // 4. Ajout des portails d'extraction
    if (module.portals) {
      for (const p of module.portals) {
        extractions.push({
          x: ox + p.x,
          y: oy + p.y,
          name: p.name,
          activationDelaySec: p.delaySec,
        });
      }
    }

    // 5. Ajout des sprites
    if (module.sprites) {
      for (const s of module.sprites) {
        sprites.push({
          x: ox + s.x,
          y: oy + s.y,
          textureId: s.textureId,
          scale: s.scale,
          itemId: s.itemId,
        });
      }
    }
  }
}
