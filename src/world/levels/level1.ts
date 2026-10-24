import type { LevelData } from '../../types';

// 0 = Sol 1 (ground1.jpg) | 1 = Mur 1 (wall1.jpg) | 2 = Sol 2 (ground2.jpg) | 3 = Coffre (chest.png) | 4 = Porte verrouillée (Door)
export const LEVEL_1: LevelData = {
  name: 'Niveau 1',
  playerSpawn: {
    x: 4.5,
    y: 3.5,
    angle: -Math.PI / 2, // Fait directement face à la lourde porte verrouillée
  },
  chestLoots: {
    // Le coffre au fond du donjon (col 3, row 8) renferme la clé légendaire de la crypte
    '3,8': ['key_crypt_skull', 'hat_myopic_necromancer'],
    // Le sanctuaire secret (col 4, row 1) accessible derrière la porte renferme l'artefact ultime
    '4,1': ['weapon_crooked_phylactery_dagger', 'armor_shrunk_black_mass_robe'],
  },
  enemies: [
    // Blob normal dans le couloir ouest
    { typeId: 'blob', x: 2.5, y: 5.5 },
    // Blob normal dans le couloir est
    { typeId: 'blob', x: 7.5, y: 5.5 },
    // Blob d'élite toxique montant la garde devant la clé
    { typeId: 'blob_elite', x: 5.5, y: 8.2 },
    // Gobelin au trésor en vadrouille dans l'allée centrale
    { typeId: 'goblin', x: 4.5, y: 6.5 },
    // Boss colossal "Roi Gélatineux Ancien" défendant la crypte secrète
    { typeId: 'blob_boss', x: 7.2, y: 1.5 },
  ],
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 2, 2, 3, 2, 2, 2, 2, 1], // Crypte secrète fermée à clé avec coffre au trésor (4, 1)
    [1, 1, 1, 1, 4, 1, 1, 1, 1, 1], // Porte verrouillée (4, 2)
    [1, 1, 0, 0, 0, 0, 3, 2, 0, 1], // Point de départ du joueur (4.5, 3.5)
    [1, 1, 0, 3, 0, 1, 2, 2, 0, 1],
    [1, 1, 0, 2, 2, 1, 1, 0, 0, 1],
    [1, 1, 0, 2, 1, 1, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 3, 0, 1],
    [1, 1, 0, 3, 0, 0, 0, 0, 0, 1], // Coffre contenant la clé (3, 8)
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
};
