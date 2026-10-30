import { TILE_TYPE } from '../../config/constants';
import { ItemDatabase } from '../../config/ItemDatabase';
import { GearScoreService } from '../../core/GearScoreService';
import type {
  DoorSpawnData,
  EnemySpawnData,
  EquipmentItem,
  EquipmentSlot,
  ExtractionSpawnData,
  LevelData,
  SpriteSpawnData,
} from '../../types';

export interface MapGeneratorOptions {
  size?: number;
  numPlayers?: number;
  seed?: number;
  spawnIndex?: number;
  playerGearScore?: number;
}

function createPrng(seed: number): () => number {
  let s = Math.floor(Math.abs(seed)) % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
  requiresBoss?: boolean;
}

interface ChunkPortal {
  x: number;
  y: number;
  name: string;
  delaySec: number;
  requiresBoss?: boolean;
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
      { x: 2, y: 5, tier: 'royal', requiresBoss: true },
      { x: 8, y: 5, tier: 'royal', requiresBoss: true },
    ],
    portals: [
      {
        x: 5.5,
        y: 3.5,
        name: 'Portail Royal du Sanctuaire',
        delaySec: 90,
        requiresBoss: true,
      },
    ],
    sprites: [
      { x: 3.5, y: 3.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 7.5, y: 3.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 3.5, y: 7.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 7.5, y: 7.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
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
    sprites: [
      { x: 3.5, y: 3.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 7.5, y: 3.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 3.5, y: 7.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
      { x: 7.5, y: 7.5, textureId: TILE_TYPE.PILLAR, scale: 1.0 },
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
    const playerGearScore = _options.playerGearScore ?? 50;
    const difficulty = GearScoreService.calculateDifficultyScaling(playerGearScore);
    const rng = _options.seed !== undefined ? createPrng(_options.seed) : Math.random;

    // Initialisation de la grille 71×71 entièrement remplie de murs
    const grid: number[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => TILE_TYPE.WALL_1)
    );
    const floorGrid: number[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => TILE_TYPE.GROUND_1)
    );

    const chestLoots: Record<string, EquipmentItem[]> = {};
    const bossChestCoords: string[] = [];
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
      const j = Math.floor(rng() * (i + 1));
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
      const template = combatPool[Math.floor(rng() * combatPool.length)];
      chunkRoleMap.set(`${shuffledZ2[i][0]},${shuffledZ2[i][1]}`, template);
    }

    // 6. Placement des modules et gravure dans la grille 71×71
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
        playerGearScore,
        bossChestCoords
      );

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
    const bossTypeId = rng() < 0.6 ? 'carrot_cake_king' : 'blood_queen';
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
      playerGearScore,
      bossChestCoords
    );

    // C. Placement des 44 modules de Zone 2 avec rotations aléatoires (0, 90, 180 ou 270°)
    for (const [cx, cy] of zone2Coords) {
      const template = chunkRoleMap.get(`${cx},${cy}`) ?? MapGenerator.ARENA_COLOSSEUM;
      const rot = Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
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
        playerGearScore,
        bossChestCoords
      );
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

    // Collecte de tous les points névralgiques de passage (portes et connexions ouvertes entre modules)
    const passagePoints: Array<{ x: number; y: number }> = [];
    for (const d of doors) {
      passagePoints.push({ x: d.x + 0.5, y: d.y + 0.5 });
    }
    for (let cy = 0; cy < MapGenerator.GRID_CHUNKS; cy++) {
      for (let cx = 0; cx < MapGenerator.GRID_CHUNKS; cx++) {
        if (cx < MapGenerator.GRID_CHUNKS - 1 && openConnections.has(makeConnKey(cx, cy, cx + 1, cy))) {
          const doorX = cx * MapGenerator.CHUNK_STEP + 10;
          const doorY = cy * MapGenerator.CHUNK_STEP + 5;
          passagePoints.push({ x: doorX + 0.5, y: doorY + 0.5 });
        }
        if (cy < MapGenerator.GRID_CHUNKS - 1 && openConnections.has(makeConnKey(cx, cy, cx, cy + 1))) {
          const doorX = cx * MapGenerator.CHUNK_STEP + 5;
          const doorY = cy * MapGenerator.CHUNK_STEP + 10;
          passagePoints.push({ x: doorX + 0.5, y: doorY + 0.5 });
        }
      }
    }
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        if (grid[y][x] === TILE_TYPE.DOOR) {
          passagePoints.push({ x: x + 0.5, y: y + 0.5 });
        }
      }
    }

    // 8.5 Filtrage et validation de sécurité absolue de TOUS les piliers : AUCUN pilier dans un couloir
    const validatedSprites: SpriteSpawnData[] = [];
    for (const sp of sprites) {
      if (sp.textureId === TILE_TYPE.PILLAR) {
        if (!MapGenerator.isPillarLocationSafe(grid, sp.x, sp.y, passagePoints)) {
          continue; // Rejeter tout pilier dans un couloir ou passage étroit
        }
      }
      validatedSprites.push(sp);
    }
    sprites.length = 0;
    sprites.push(...validatedSprites);

    // 9. Dispersion sporadique des éléments de décor physiques (tonneaux, caisses, tables)
    MapGenerator.placeSporadicProps(
      grid,
      sprites,
      rng,
      playerSpawns,
      extractions,
      enemies,
      passagePoints
    );

    // 10. Sélection du point de réveil du joueur parmi les 4 cryptes
    let chosenSpawn = playerSpawns[0];
    if (_options.spawnIndex !== undefined && playerSpawns.length > 0) {
      chosenSpawn = playerSpawns[_options.spawnIndex % playerSpawns.length];
    } else {
      chosenSpawn =
        playerSpawns[Math.floor(rng() * playerSpawns.length)] ?? {
          x: 2.5,
          y: 8.5,
          angle: -Math.PI / 2,
        };
    }

    const expId = _options.seed !== undefined ? `#${_options.seed}` : `#${Math.floor(1000 + rng() * 9000)}`;

    return {
      name: `Citadelle Royale 71×71 (Expédition ${expId})`,
      grid,
      floorGrid,
      skyTileId: TILE_TYPE.SKY_1,
      chestLoots,
      bossChestCoords,
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
      difficulty,
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
        requiresBoss: c.requiresBoss,
      };
    });

    // Rotation des portails
    const newPortals = template.portals?.map((p) => {
      const rc = rotCoord(p.x, p.y);
      return {
        x: rc.x,
        y: rc.y,
        name: p.name,
        delaySec: p.delaySec,
        requiresBoss: p.requiresBoss,
      };
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
   * Génère le butin dynamique d'un coffre selon son tier et le Gear Score du joueur,
   * en tirant les raretés depuis la table de progression continue.
   */
  private static generateChestLoot(
    tier: 'starter' | 'standard' | 'high' | 'royal' | undefined,
    playerGearScore: number,
    fixedLoot?: string[]
  ): EquipmentItem[] {
    const lootList: EquipmentItem[] = [];

    if (fixedLoot) {
      for (const rawId of fixedLoot) {
        const tpl = ItemDatabase.getItemById(rawId);
        if (tpl) {
          lootList.push(GearScoreService.rollItem(tpl, playerGearScore));
        }
      }
      // 1 objet bonus adapté au Gear Score
      const bonusRarity = GearScoreService.rollRarityForGearScore(playerGearScore, 0);
      const bonusTpl = ItemDatabase.getRandomItemByRarity(bonusRarity);
      if (bonusTpl) {
        lootList.push(GearScoreService.rollItem(bonusTpl, playerGearScore));
      }
      return lootList;
    }

    let count = 2;
    let bonusScore = 0;

    if (tier === 'starter') {
      count = 1;
      bonusScore = -20;
    } else if (tier === 'royal') {
      count = 2;
      bonusScore = 100;
    } else if (tier === 'high') {
      count = 3;
      bonusScore = 40;
    } else {
      count = 2;
      bonusScore = 0;
    }

    const standardSlots: EquipmentSlot[] = ['weapon', 'armor', 'hat', 'boots'];
    const shuffledSlots = [...standardSlots].sort(() => Math.random() - 0.5);

    for (let k = 0; k < count; k++) {
      const preferredSlot = shuffledSlots[k % shuffledSlots.length];
      const rarity = GearScoreService.rollRarityForGearScore(playerGearScore, bonusScore);
      const tpl =
        ItemDatabase.getRandomItemByRarity(rarity, preferredSlot) ??
        ItemDatabase.getRandomItemByRarity(rarity);
      if (tpl) {
        lootList.push(GearScoreService.rollItem(tpl, playerGearScore));
      }
    }

    return lootList;
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
    chestLoots: Record<string, EquipmentItem[]>,
    playerGearScore: number = 50,
    bossChestCoords: string[] = []
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
        if (c.requiresBoss) {
          bossChestCoords.push(keyCoord);
        }
        chestLoots[keyCoord] = MapGenerator.generateChestLoot(
          c.tier,
          playerGearScore,
          c.fixedLoot
        );
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
          requiresBoss: p.requiresBoss,
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

  /**
   * Vérifie si une coordonnée de grille est un sol praticable (GROUND_1 ou GROUND_2), ni mur ni porte.
   */
  public static isWalkableGround(grid: number[][], x: number, y: number): boolean {
    if (x <= 0 || y <= 0 || x >= grid.length - 1 || y >= grid.length - 1) return false;
    const t = grid[y][x];
    return t === TILE_TYPE.GROUND_1 || t === TILE_TYPE.GROUND_2;
  }

  /**
   * Valide la sécurité physique d'un pilier :
   * Les piliers ne doivent JAMAIS être placés dans des couloirs ni devant des passages ou portes.
   * Ils doivent exclusivement se trouver dans de grandes pièces ouvertes (au moins 5×5 cases de sol praticable)
   * avec au moins 1 case de passage libre sur chacun de leurs 4 côtés.
   */
  public static isPillarLocationSafe(
    grid: number[][],
    x: number,
    y: number,
    passagePoints: Array<{ x: number; y: number }>
  ): boolean {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    const size = grid.length;
    if (gx <= 1 || gy <= 1 || gx >= size - 2 || gy >= size - 2) return false;

    // Doit reposer sur un sol praticable
    if (!MapGenerator.isWalkableGround(grid, gx, gy)) return false;

    // Distance minimale avec toute porte ou passage (>= 3.2 cases)
    for (const p of passagePoints) {
      if (Math.hypot(x - p.x, y - p.y) < 3.2) {
        return false;
      }
    }

    // Mesure du dégagement continu dans les 4 directions
    let distN = 0; while (distN < 8 && MapGenerator.isWalkableGround(grid, gx, gy - 1 - distN)) distN++;
    let distS = 0; while (distS < 8 && MapGenerator.isWalkableGround(grid, gx, gy + 1 + distS)) distS++;
    let distW = 0; while (distW < 8 && MapGenerator.isWalkableGround(grid, gx - 1 - distW, gy)) distW++;
    let distE = 0; while (distE < 8 && MapGenerator.isWalkableGround(grid, gx + 1 + distE, gy)) distE++;

    // Un pilier doit impérativement être dans une grande pièce ouverte :
    // - Au moins 5 cases ouvertes en Y (spanY >= 5)
    // - Au moins 5 cases ouvertes en X (spanX >= 5)
    if (distN + distS + 1 < 5 || distW + distE + 1 < 5) {
      return false;
    }

    // Doit avoir au moins 1 case praticable de chaque côté (Nord, Sud, Est, Ouest)
    if (distN < 1 || distS < 1 || distW < 1 || distE < 1) {
      return false;
    }

    return true;
  }

  /**
   * Disperse de manière sporadique des éléments de décor physiques (tonneaux, caisses, tables)
   * le long des murs dans les salles ouvertes.
   * RÈGLES STRICTES :
   * - Interdiction formelle dans tout couloir ou passage de transition (spanX < 4 ou spanY < 4).
   * - Interdiction à proximité de toute porte ou entrée de passage (< 3.2 cases).
   * - Espace garanti pour passer à côté : la rangée adjacente entière doit être 100% libre et praticable.
   * - Si un emplacement ne remplit pas ces conditions, aucun prop n'est placé.
   */
  private static placeSporadicProps(
    grid: number[][],
    sprites: SpriteSpawnData[],
    rng: () => number,
    playerSpawns: Array<{ x: number; y: number }>,
    extractions: ExtractionSpawnData[],
    enemies: EnemySpawnData[],
    passagePoints: Array<{ x: number; y: number }>
  ): void {
    const size = grid.length;

    for (let cy = 0; cy < MapGenerator.GRID_CHUNKS; cy++) {
      for (let cx = 0; cx < MapGenerator.GRID_CHUNKS; cx++) {
        // Dans chaque module de salle, ~80% de chance d'avoir du mobilier et des conteneurs abandonnés
        if (rng() < 0.2) {
          continue;
        }

        const count = 1 + Math.floor(rng() * 2);
        const originX = cx * MapGenerator.CHUNK_STEP;
        const originY = cy * MapGenerator.CHUNK_STEP;

        for (let p = 0; p < count; p++) {
          const roll = rng();
          let textureId: number = TILE_TYPE.BARREL;
          let scale = 0.44;

          if (roll < 0.45) {
            textureId = TILE_TYPE.BARREL;
            scale = 0.44;
          } else if (roll < 0.80) {
            textureId = TILE_TYPE.BOX;
            scale = 0.42;
          } else {
            textureId = TILE_TYPE.TABLE;
            scale = 0.42;
          }

          // Tentatives pour trouver un emplacement valide adossé à un mur
          for (let attempt = 0; attempt < 50; attempt++) {
            const lx = 1 + Math.floor(rng() * 9);
            const ly = 1 + Math.floor(rng() * 9);
            const gx = originX + lx;
            const gy = originY + ly;

            if (gx <= 1 || gy <= 1 || gx >= size - 2 || gy >= size - 2) {
              continue;
            }

            // 1. Doit être un sol praticable (GROUND_1 ou GROUND_2), ni un mur ni une porte
            if (!MapGenerator.isWalkableGround(grid, gx, gy)) {
              continue;
            }

            // 2. Sécurité absolue : JAMAIS à proximité d'une porte ou d'un passage entre modules (>= 3.2 cases)
            let tooCloseToPassage = false;
            for (const pt of passagePoints) {
              if (Math.hypot(gx + 0.5 - pt.x, gy + 0.5 - pt.y) < 3.2) {
                tooCloseToPassage = true;
                break;
              }
            }
            if (tooCloseToPassage) {
              continue;
            }

            // 3. RÈGLE STRICTE : AUCUN PROP DANS UN COULOIR (largeur ou hauteur <= 3 cases)
            // On calcule l'étendue continue de sol praticable dans les 4 directions
            let distN = 0; while (distN < 8 && MapGenerator.isWalkableGround(grid, gx, gy - 1 - distN)) distN++;
            let distS = 0; while (distS < 8 && MapGenerator.isWalkableGround(grid, gx, gy + 1 + distS)) distS++;
            let distW = 0; while (distW < 8 && MapGenerator.isWalkableGround(grid, gx - 1 - distW, gy)) distW++;
            let distE = 0; while (distE < 8 && MapGenerator.isWalkableGround(grid, gx + 1 + distE, gy)) distE++;

            const spanY = distN + distS + 1;
            const spanX = distW + distE + 1;

            // Doit être une salle spacieuse d'au moins 4×4 cases ouvertes
            if (spanY < 4 || spanX < 4) {
              continue;
            }

            // 4. Doit être adossé à un pan de mur pour un encombrement naturel le long des parois
            const wallNorth = !MapGenerator.isWalkableGround(grid, gx, gy - 1);
            const wallSouth = !MapGenerator.isWalkableGround(grid, gx, gy + 1);
            const wallWest = !MapGenerator.isWalkableGround(grid, gx - 1, gy);
            const wallEast = !MapGenerator.isWalkableGround(grid, gx + 1, gy);

            // Ne peut JAMAIS être coincé entre deux murs opposés
            if ((wallNorth && wallSouth) || (wallWest && wallEast)) {
              continue;
            }

            // Doit toucher au moins un mur
            if (!wallNorth && !wallSouth && !wallWest && !wallEast) {
              continue;
            }

            // 5. RÈGLE FONDAMENTALE : IL DOIT TOUJOURS Y AVOIR UN ESPACE POUR PASSER À CÔTÉ
            // La bande de passage adjacente de 3 cases ouvertes doit être 100% praticable et libre
            let hasBypassSpace = false;

            const isBypassTileFree = (bx: number, by: number): boolean => {
              if (!MapGenerator.isWalkableGround(grid, bx, by)) return false;
              for (const sp of sprites) {
                if (Math.hypot(bx + 0.5 - sp.x, by + 0.5 - sp.y) < 1.8) {
                  return false;
                }
              }
              return true;
            };

            if (wallNorth && distS >= 2) {
              // Adossé au Nord : la rangée Sud (gy + 1) offre un passage complet de circulation
              hasBypassSpace =
                isBypassTileFree(gx - 1, gy + 1) &&
                isBypassTileFree(gx, gy + 1) &&
                isBypassTileFree(gx + 1, gy + 1);
            } else if (wallSouth && distN >= 2) {
              // Adossé au Sud : la rangée Nord (gy - 1) offre un passage complet de circulation
              hasBypassSpace =
                isBypassTileFree(gx - 1, gy - 1) &&
                isBypassTileFree(gx, gy - 1) &&
                isBypassTileFree(gx + 1, gy - 1);
            } else if (wallWest && distE >= 2) {
              // Adossé à l'Ouest : la colonne Est (gx + 1) offre un passage complet de circulation
              hasBypassSpace =
                isBypassTileFree(gx + 1, gy - 1) &&
                isBypassTileFree(gx + 1, gy) &&
                isBypassTileFree(gx + 1, gy + 1);
            } else if (wallEast && distW >= 2) {
              // Adossé à l'Est : la colonne Ouest (gx - 1) offre un passage complet de circulation
              hasBypassSpace =
                isBypassTileFree(gx - 1, gy - 1) &&
                isBypassTileFree(gx - 1, gy) &&
                isBypassTileFree(gx - 1, gy + 1);
            }

            if (!hasBypassSpace) {
              continue;
            }

            const posX = gx + 0.5;
            const posY = gy + 0.5;

            // Distance de sécurité avec les points d'apparition (>= 3.0 cases)
            let tooCloseToSpawn = false;
            for (const s of playerSpawns) {
              if (Math.hypot(posX - s.x, posY - s.y) < 3.0) {
                tooCloseToSpawn = true;
                break;
              }
            }
            if (tooCloseToSpawn) continue;

            // Distance de sécurité avec les cercles d'extraction (>= 3.0 cases)
            let tooCloseToPortal = false;
            for (const ext of extractions) {
              if (Math.hypot(posX - ext.x, posY - ext.y) < 3.0) {
                tooCloseToPortal = true;
                break;
              }
            }
            if (tooCloseToPortal) continue;

            // Distance avec les autres sprites (piliers, coffres, autres props) (>= 2.5 cases)
            let tooCloseToSprite = false;
            for (const sp of sprites) {
              if (Math.hypot(posX - sp.x, posY - sp.y) < 2.5) {
                tooCloseToSprite = true;
                break;
              }
            }
            if (tooCloseToSprite) continue;

            // Distance avec les monstres (>= 1.8 cases)
            let tooCloseToEnemy = false;
            for (const en of enemies) {
              if (Math.hypot(posX - en.x, posY - en.y) < 1.8) {
                tooCloseToEnemy = true;
                break;
              }
            }
            if (tooCloseToEnemy) continue;

            // Position 100% validée avec espace de passage garanti
            sprites.push({
              x: posX,
              y: posY,
              textureId,
              scale,
            });
            break;
          }
        }
      }
    }
  }
}
