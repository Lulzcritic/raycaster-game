import { TILE_TYPE } from '../../config/constants';
import { ItemDatabase } from '../../config/ItemDatabase';
import type {
  DoorSpawnData,
  EnemySpawnData,
  ExtractionSpawnData,
  LevelData,
  Vector2D,
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
   * Génère un niveau d'extraction complet respectant l'architecture macro circulaire
   * en miroir à 6 secteurs et la génération procédurale aléatoire des intérieurs.
   */
  public static generate(options: MapGeneratorOptions = {}): LevelData {
    const size = options.size ?? MapGenerator.DEFAULT_SIZE;
    const center = Math.floor(size / 2); // 32 pour size = 65

    // 1. Initialisation des grilles entièrement remplies de murs
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
    const playerSpawns: Vector2D[] = [];

    // Helper pour creuser une case
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

    // Helper pour tracer et creuser une ligne épaisse
    const carveLine = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      thickness = 1,
      floorTile: number = TILE_TYPE.GROUND_1
    ): void => {
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.max(1, Math.ceil(dist * 2));
      const rad = Math.max(0, Math.floor(thickness));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const cx = Math.round(x0 + (x1 - x0) * t);
        const cy = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            carve(cx + dx, cy + dy, floorTile);
          }
        }
      }
    };

    // =========================================================================
    // ÉTAPE 1 : ZONE 3 - LE SANCTUAIRE CENTRAL (ARÈNE DU BOSS) [0 <= r <= 6.5]
    // =========================================================================
    const VAULT_INNER_R = 6.0;
    const VAULT_WALL_R = 7;

    for (let y = center - 7; y <= center + 7; y++) {
      for (let x = center - 7; x <= center + 7; x++) {
        const r = Math.hypot(x - center, y - center);
        if (r <= VAULT_INNER_R) {
          carve(x, y, TILE_TYPE.GROUND_2);
        }
      }
    }

    // Piliers décoratifs d'obsidienne de l'arène centrale
    const pillarOffsets = [
      [-3, -3],
      [3, -3],
      [-3, 3],
      [3, 3],
    ];
    for (const [px, py] of pillarOffsets) {
      grid[center + py][center + px] = TILE_TYPE.WALL_1;
    }

    // Boss colossal au centre de l'arène
    enemies.push({
      typeId: 'blob_boss',
      x: center + 0.5,
      y: center + 0.5,
    });

    // 2 Coffres Royaux du Sanctuaire
    const royalChest1Pos = { x: center - 4, y: center };
    const royalChest2Pos = { x: center + 4, y: center };
    grid[royalChest1Pos.y][royalChest1Pos.x] = TILE_TYPE.CHEST;
    grid[royalChest2Pos.y][royalChest2Pos.x] = TILE_TYPE.CHEST;
    chestLoots[`${royalChest1Pos.x},${royalChest1Pos.y}`] = [
      'weapon_crooked_phylactery_dagger',
      'armor_shrunk_black_mass_robe',
    ];
    chestLoots[`${royalChest2Pos.x},${royalChest2Pos.y}`] = [
      'weapon_arthritic_lich_staff',
      'armor_cursed_bone_carapace',
    ];

    // Portail d'extraction royal au fond du sanctuaire
    extractions.push({
      x: center + 0.5,
      y: center - 3.5,
      name: 'Portail Royal du Sanctuaire',
      activationDelaySec: 75,
    });

    // Portes du Sanctuaire (Zone 2 -> Zone 3) réparties sur les 6 axes radiaux
    for (let s = 0; s < MapGenerator.NUM_SECTORS; s++) {
      const angle = s * (Math.PI / 3) + Math.PI / 6;
      const doorX = Math.round(center + VAULT_WALL_R * Math.cos(angle));
      const doorY = Math.round(center + VAULT_WALL_R * Math.sin(angle));

      // Creuse le passage d'accès avant et après la porte
      carveLine(
        center + (VAULT_WALL_R - 1.5) * Math.cos(angle),
        center + (VAULT_WALL_R - 1.5) * Math.sin(angle),
        center + (VAULT_WALL_R + 1.8) * Math.cos(angle),
        center + (VAULT_WALL_R + 1.8) * Math.sin(angle),
        1,
        TILE_TYPE.GROUND_2
      );

      grid[doorY][doorX] = TILE_TYPE.DOOR;
      doors.push({
        x: doorX,
        y: doorY,
        requiredKeyId: 'key_crypt_skull',
      });
    }

    // =========================================================================
    // ÉTAPE 2 : ZONE 2 - L'ANNEAU CENTRAL PARTAGÉ (PvPvE) [8 <= r <= 18]
    // =========================================================================
    // A. Allée circulaire intérieure (r ~ 9 à 11)
    for (let y = center - 18; y <= center + 18; y++) {
      for (let x = center - 18; x <= center + 18; x++) {
        const r = Math.hypot(x - center, y - center);
        if (r >= 9.2 && r <= 11.2) {
          carve(x, y, TILE_TYPE.GROUND_1);
        }
      }
    }

    // B. Allée circulaire extérieure (r ~ 15 à 17)
    for (let y = center - 18; y <= center + 18; y++) {
      for (let x = center - 18; x <= center + 18; x++) {
        const r = Math.hypot(x - center, y - center);
        if (r >= 15.2 && r <= 17.2) {
          carve(x, y, TILE_TYPE.GROUND_1);
        }
      }
    }

    // C. Connecteurs radiaux et 6 Grandes Salles Intermédiaires sur les axes de secteurs
    const zone2CandidateChestSpots: Array<{ x: number; y: number }> = [];

    for (let s = 0; s < MapGenerator.NUM_SECTORS; s++) {
      const angle = s * (Math.PI / 3) + Math.PI / 6;

      // Voie royale reliant l'anneau intérieur à la porte de secteur
      carveLine(
        center + 8.5 * Math.cos(angle),
        center + 8.5 * Math.sin(angle),
        center + 18.5 * Math.cos(angle),
        center + 18.5 * Math.sin(angle),
        2,
        TILE_TYPE.GROUND_1
      );

      // Grande salle intermédiaire centrée à r = 13.5
      const hallCenterX = Math.round(center + 13.5 * Math.cos(angle));
      const hallCenterY = Math.round(center + 13.5 * Math.sin(angle));
      const hallRadius = 2.8;

      for (let hy = -3; hy <= 3; hy++) {
        for (let hx = -3; hx <= 3; hx++) {
          if (Math.hypot(hx, hy) <= hallRadius) {
            carve(hallCenterX + hx, hallCenterY + hy, TILE_TYPE.GROUND_1);
          }
        }
      }

      // Candidats de coffres dans les recoins des salles intermédiaires
      zone2CandidateChestSpots.push(
        { x: hallCenterX + 2, y: hallCenterY + 1 },
        { x: hallCenterX - 2, y: hallCenterY - 1 },
        { x: hallCenterX + 1, y: hallCenterY - 2 }
      );

      // Monstre Élite dans chaque grande salle
      enemies.push({
        typeId: 'blob_elite',
        x: hallCenterX + 0.5,
        y: hallCenterY + 0.5,
      });

      // Monstre normal patrouillant dans les couloirs de l'anneau
      const patrolX = Math.round(center + 16 * Math.cos(angle + 0.25));
      const patrolY = Math.round(center + 16 * Math.sin(angle + 0.25));
      enemies.push({
        typeId: 'blob',
        x: patrolX + 0.5,
        y: patrolY + 0.5,
      });
    }

    // Voies de traverse entre les secteurs (sur les angles diviseurs k * PI/3)
    for (let k = 0; k < MapGenerator.NUM_SECTORS; k++) {
      const dividerAngle = k * (Math.PI / 3);
      carveLine(
        center + 10 * Math.cos(dividerAngle),
        center + 10 * Math.sin(dividerAngle),
        center + 16.5 * Math.cos(dividerAngle),
        center + 16.5 * Math.sin(dividerAngle),
        1,
        TILE_TYPE.GROUND_1
      );

      // Monstre normal supplémentaire dans chaque croisement
      const crossX = Math.round(center + 11 * Math.cos(dividerAngle));
      const crossY = Math.round(center + 11 * Math.sin(dividerAngle));
      enemies.push({
        typeId: 'blob',
        x: crossX + 0.5,
        y: crossY + 0.5,
      });
    }

    // D. Portails d'extraction de Zone 2 répartis sur 3 secteurs distincts (1, 3, 5)
    const portalSectors = [1, 3, 5];
    const portalNames = [
      "Portail de l'Aura Sépulcrale",
      'Portail des Catacombes Oubliées',
      'Portail du Brasier Éthéré',
    ];
    const portalDelays = [30, 50, 70];

    portalSectors.forEach((secIdx, idx) => {
      const angle = secIdx * (Math.PI / 3) + Math.PI / 6;
      const portX = Math.round(center + 13.5 * Math.cos(angle)) + 0.5;
      const portY = Math.round(center + 13.5 * Math.sin(angle)) + 0.5;

      extractions.push({
        x: portX,
        y: portY,
        name: portalNames[idx],
        activationDelaySec: portalDelays[idx],
      });
    });

    // =========================================================================
    // ÉTAPE 3 : ZONE 1 - LES 6 QUARTIERS DE DÉPART INDIVIDUELS [20 <= r <= 29]
    // =========================================================================
    const SECTOR_GATE_R = 19;

    // A. Érection des murs radiaux infranchissables entre les quartiers
    // Les cloisons sont placées sur les angles multiples de PI/3 de r = 18.5 à r = 30.5
    for (let k = 0; k < MapGenerator.NUM_SECTORS; k++) {
      const wallAngle = k * (Math.PI / 3);
      for (let r = 18; r <= 31; r += 0.5) {
        for (let da = -0.06; da <= 0.06; da += 0.03) {
          const wx = Math.round(center + r * Math.cos(wallAngle + da));
          const wy = Math.round(center + r * Math.sin(wallAngle + da));
          if (wx >= 0 && wx < size && wy >= 0 && wy < size) {
            grid[wy][wx] = TILE_TYPE.WALL_1;
          }
        }
      }
    }

    // B. Mur d'enceinte circulaire scellant la Zone 1 contre la Zone 2 (r = 19)
    for (let deg = 0; deg < 360; deg += 1) {
      const rad = (deg * Math.PI) / 180;
      const bx = Math.round(center + SECTOR_GATE_R * Math.cos(rad));
      const by = Math.round(center + SECTOR_GATE_R * Math.sin(rad));
      if (bx >= 0 && bx < size && by >= 0 && by < size) {
        grid[by][bx] = TILE_TYPE.WALL_1;
      }
    }

    // C. Génération de l'intérieur de chaque Quartier de spawn (0 à 5) : Mini-Labyrinthe de catacombes
    for (let s = 0; s < MapGenerator.NUM_SECTORS; s++) {
      const angle = s * (Math.PI / 3) + Math.PI / 6;

      // Helper de projection coordonnées locales du secteur (r, t) -> coordonnées monde (x, y)
      // r = distance au centre (rayon)
      // t = déport latéral tangentiel (perpendiculaire à l'axe radial)
      const toWorld = (r: number, t: number): { x: number; y: number } => ({
        x: Math.round(center + r * Math.cos(angle) - t * Math.sin(angle)),
        y: Math.round(center + r * Math.sin(angle) + t * Math.cos(angle)),
      });

      // 1. Porte de sortie du quartier (Zone 1 -> Zone 2) à r = 19
      const gatePos = toWorld(SECTOR_GATE_R, 0);
      const gateX = gatePos.x;
      const gateY = gatePos.y;

      // Creuse l'accès à travers la herse
      const gateIn = toWorld(SECTOR_GATE_R - 1.5, 0);
      const gateOut = toWorld(SECTOR_GATE_R + 1.5, 0);
      carveLine(gateIn.x, gateIn.y, gateOut.x, gateOut.y, 1, TILE_TYPE.GROUND_1);

      grid[gateY][gateX] = TILE_TYPE.DOOR;
      doors.push({
        x: gateX,
        y: gateY,
        requiredKeyId: 'key_spawn_rusty',
      });

      // 2. Vestibule devant la herse (r ~ 20.5, t = 0)
      const vestibule = toWorld(20.5, 0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carve(vestibule.x + dx, vestibule.y + dy, TILE_TYPE.GROUND_1);
        }
      }

      // 3. Boucle / Chicane de catacombes autour d'un pilier central (r ~ 21 à 23.5)
      // Contournement par la gauche et par la droite pour briser la ligne droite
      const chicaneLeft = toWorld(22.2, -2.4);
      const chicaneRight = toWorld(22.2, 2.4);
      const hallEntrance = toWorld(23.8, 0);

      carveLine(vestibule.x, vestibule.y, chicaneLeft.x, chicaneLeft.y, 1, TILE_TYPE.GROUND_1);
      carveLine(chicaneLeft.x, chicaneLeft.y, hallEntrance.x, hallEntrance.y, 1, TILE_TYPE.GROUND_1);

      carveLine(vestibule.x, vestibule.y, chicaneRight.x, chicaneRight.y, 1, TILE_TYPE.GROUND_1);
      carveLine(chicaneRight.x, chicaneRight.y, hallEntrance.x, hallEntrance.y, 1, TILE_TYPE.GROUND_1);

      // Monstre en patrouille dans la chicane
      enemies.push({
        typeId: 'blob',
        x: chicaneLeft.x + 0.5,
        y: chicaneLeft.y + 0.5,
      });

      // 4. Salle centrale d'intersection (r ~ 24.5, t ~ 0)
      const midHall = toWorld(24.5, 0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carve(midHall.x + dx, midHall.y + dy, TILE_TYPE.GROUND_1);
        }
      }

      // 5. Aile A : Crypte de la Clé Rouillée (r ~ 25.5, t = ±3.8)
      // Alternance de côté selon le secteur pour varier les configurations
      const keySign = s % 2 === 0 ? -1 : 1;
      const keyCryptCenter = toWorld(25.5, keySign * 3.8);

      carveLine(midHall.x, midHall.y, keyCryptCenter.x, keyCryptCenter.y, 1, TILE_TYPE.GROUND_1);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carve(keyCryptCenter.x + dx, keyCryptCenter.y + dy, TILE_TYPE.GROUND_1);
        }
      }

      // Coffre de la clé placé dans l'alcôve au fond de la crypte
      const keyChestPos = toWorld(26.2, keySign * 4.4);
      carve(keyChestPos.x, keyChestPos.y, TILE_TYPE.GROUND_1);
      grid[keyChestPos.y][keyChestPos.x] = TILE_TYPE.CHEST;

      const starterWeaponOrHat =
        s % 2 === 0
          ? 'weapon_splintered_apprentice_wand'
          : 'hat_leech_infested_mitre';
      chestLoots[`${keyChestPos.x},${keyChestPos.y}`] = [
        'key_spawn_rusty',
        starterWeaponOrHat,
      ];

      // Monstre gardien surveillant la crypte de la clé
      enemies.push({
        typeId: 'blob',
        x: keyCryptCenter.x + 0.5,
        y: keyCryptCenter.y + 0.5,
      });

      // 6. Aile B : Armurerie / Coffre secondaire (r ~ 25.2, t = côté opposé)
      const secSign = -keySign;
      const secCryptCenter = toWorld(25.2, secSign * 3.6);

      carveLine(midHall.x, midHall.y, secCryptCenter.x, secCryptCenter.y, 1, TILE_TYPE.GROUND_1);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carve(secCryptCenter.x + dx, secCryptCenter.y + dy, TILE_TYPE.GROUND_1);
        }
      }

      const secChestPos = toWorld(25.8, secSign * 4.2);
      carve(secChestPos.x, secChestPos.y, TILE_TYPE.GROUND_1);
      grid[secChestPos.y][secChestPos.x] = TILE_TYPE.CHEST;

      const starterArmorOrBoots =
        s % 2 === 0 ? 'armor_tattered_gambeson' : 'boots_cobbled_grave_treaders';
      chestLoots[`${secChestPos.x},${secChestPos.y}`] = [starterArmorOrBoots];

      // 7. Crypte de Réveil / Spawn du joueur (r ~ 27.5, t = 0)
      const spawnCryptCenter = toWorld(27.4, 0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          carve(spawnCryptCenter.x + dx, spawnCryptCenter.y + dy, TILE_TYPE.GROUND_1);
        }
      }

      // Brise-vue central à r = 26.2, t = 0 pour masquer la vue directe
      // et deux passages coudés contournant vers la salle d'intersection
      const bypassLeft = toWorld(26.2, -1.8);
      const bypassRight = toWorld(26.2, 1.8);

      carveLine(spawnCryptCenter.x, spawnCryptCenter.y, bypassLeft.x, bypassLeft.y, 1, TILE_TYPE.GROUND_1);
      carveLine(bypassLeft.x, bypassLeft.y, midHall.x, midHall.y, 1, TILE_TYPE.GROUND_1);

      carveLine(spawnCryptCenter.x, spawnCryptCenter.y, bypassRight.x, bypassRight.y, 1, TILE_TYPE.GROUND_1);
      carveLine(bypassRight.x, bypassRight.y, midHall.x, midHall.y, 1, TILE_TYPE.GROUND_1);

      // Point de départ du joueur au fond de la crypte
      const spawnPoint: Vector2D = {
        x: spawnCryptCenter.x + 0.5,
        y: spawnCryptCenter.y + 0.5,
      };
      playerSpawns.push(spawnPoint);
    }

    // =========================================================================
    // ÉTAPE 4 : REMPLISSAGE DES COFFRES DE ZONE 2 & DISTRIBUTION DE LA CLÉ BOSS
    // =========================================================================
    // Déduplication des emplacements de coffres valides et libres
    const validChestSpots = zone2CandidateChestSpots.filter(
      (pos) =>
        pos.x >= 1 &&
        pos.x < size - 1 &&
        pos.y >= 1 &&
        pos.y < size - 1 &&
        grid[pos.y][pos.x] === TILE_TYPE.GROUND_1
    );

    // Mélange aléatoire (Fisher-Yates)
    for (let i = validChestSpots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validChestSpots[i], validChestSpots[j]] = [
        validChestSpots[j],
        validChestSpots[i],
      ];
    }

    // Sélectionne 3 coffres qui contiendront la Clé en Os de la Crypte (Sanctum Key)
    const NUM_BOSS_KEYS = 3;
    const poolItems = ItemDatabase.getAllItems().filter(
      (item) => item.slot !== 'key'
    );

    validChestSpots.slice(0, 12).forEach((pos, idx) => {
      grid[pos.y][pos.x] = TILE_TYPE.CHEST;

      const loots: string[] = [];
      if (idx < NUM_BOSS_KEYS) {
        // Clé du Boss garantie dans ce coffre
        loots.push('key_crypt_skull');
      }

      // Ajoute 1 à 2 pièces d'équipement de bonne qualité
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
    // ÉTAPE 5 : SCELLAGE DU PÉRIMÈTRE EXTÉRIEUR (r >= 30)
    // =========================================================================
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - center, y - center);
        if (r >= 30.0 || x === 0 || y === 0 || x === size - 1 || y === size - 1) {
          grid[y][x] = TILE_TYPE.WALL_1;
        }
      }
    }

    // =========================================================================
    // ÉTAPE 6 : SÉLECTION DU SPAWN JOUEUR PAR DÉFAUT
    // =========================================================================
    const initialSpawnIndex = Math.floor(Math.random() * playerSpawns.length);
    const chosenSpawn = playerSpawns[initialSpawnIndex] ?? {
      x: center + 0.5,
      y: center + 26.5,
    };
    const chosenAngle =
      initialSpawnIndex * (Math.PI / 3) + Math.PI / 6 + Math.PI;

    return {
      name: `Donjon d'Extraction (Session #${Math.floor(1000 + Math.random() * 9000)})`,
      grid,
      floorGrid,
      skyTileId: TILE_TYPE.SKY_1,
      chestLoots,
      enemies,
      doors,
      extractions,
      playerSpawns,
      playerSpawn: {
        x: chosenSpawn.x,
        y: chosenSpawn.y,
        angle: chosenAngle,
      },
    };
  }
}
