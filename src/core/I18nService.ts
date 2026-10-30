export type Language = 'en' | 'fr';

export type GearTierKey =
  | 'beginner'
  | 'novice'
  | 'initiate'
  | 'adventurer'
  | 'veteran'
  | 'champion'
  | 'master'
  | 'legend';

export interface ItemTranslation {
  name: string;
  effect: string;
  description: string;
}

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // App & Title
    'app.title': 'The Old Citadel (TOC) • Dungeon Extraction PvPvE',
    'app.tagline': 'DUNGEON EXTRACTION RPG • PVPVE',
    'app.loading': 'INITIALIZING CITADEL ARCANES...',
    'app.loading_footer': 'LOADING CITADEL ASSETS...',
    'app.ready': 'Ready for expedition!',

    // Common Buttons & Actions
    'btn.play': 'PLAY',
    'btn.resume': 'RESUME',
    'btn.settings': 'SETTINGS',
    'btn.back': 'BACK',
    'btn.cancel': 'CANCEL',
    'btn.close': 'CLOSE',
    'btn.continue': 'CONTINUE',
    'btn.refresh': 'REFRESH',
    'btn.login': 'LOG IN',
    'btn.register': 'REGISTER',
    'btn.logout': 'LOG OUT',
    'btn.guest': 'PLAY AS GUEST',
    'btn.equip': 'EQUIP',
    'btn.unequip': 'UNEQUIP',
    'btn.stash': 'STASH',
    'btn.take': 'TAKE',
    'btn.upgrade': 'UPGRADE',
    'btn.claim': 'CLAIM REWARD',
    'btn.claimed': 'CLAIMED',
    'btn.launch': 'LAUNCH GAME',
    'btn.cancel_queue': '✕ CANCEL AND RETURN TO CAMP [ESC]',
    'btn.abandon': 'ABANDON EXPEDITION (DEATH)',
    'btn.main_menu': 'MAIN MENU (DEATH)',
    'btn.return_camp': 'RETURN TO CAMP [R]',
    'btn.spectate': '👁️ SPECTATE SQUAD [V]',

    // Main Menu
    'menu.login_register': 'LOG IN / REGISTER',
    'menu.ladder': 'RANKINGS (LADDER)',
    'menu.settings': 'SETTINGS',
    'menu.guest_badge': 'Guest Mode (saving inactive)',
    'menu.guest_tooltip': 'Log in to save your loot and gold to the database.',
    'menu.connected_badge': '🛡️ Adventurer: {name} (Cloud Save active)',
    'menu.connected_tooltip': 'Logged in as {name}. Click to manage your account.',

    // Settings
    'settings.title': 'SETTINGS',
    'settings.fov': 'FIELD OF VIEW (FOV)',
    'settings.fov_zoom': '60° (ZOOM)',
    'settings.fov_wide': '110° (WIDE)',
    'settings.keyboard': 'KEYBOARD LAYOUT',
    'settings.language': 'LANGUAGE',
    'settings.audio': 'AUDIO SETTINGS',
    'settings.music_on': 'MUSIC : ON',
    'settings.music_off': 'MUSIC : OFF',
    'settings.sfx_on': 'SFX : ON',
    'settings.sfx_off': 'SFX : OFF',
    'settings.sound_active': 'SOUND ACTIVE',
    'settings.sound_muted': 'ALL MUTED',
    'settings.sound_partial': 'PARTIAL',
    'settings.controls_title': '✦ GAME CONTROLS ✦',
    'settings.ctrl_move': 'Forward / Backward',
    'settings.ctrl_strafe': 'Strafe Left / Right',
    'settings.ctrl_mouse': 'Look Around',
    'settings.ctrl_fireball': 'Fireball',
    'settings.ctrl_orb': 'Bouncing Purple Orb',
    'settings.ctrl_interact': 'Interact (Chests, Doors, Merchant)',
    'settings.ctrl_pause': 'In-game Pause Menu',

    // HUD & Spells
    'hud.health': 'HP {current} / {max}',
    'hud.spell_primary_title': 'Primary Spell: Fireball [Left Click / Space]',
    'hud.spell_secondary_title': 'Secondary Spell: Bouncing Purple Orb [Right Click] — +50% damage per bounce!',
    'hud.zone_default': 'ZONE 1 - STARTING DISTRICT',
    'hud.key_left_click': 'L-CLICK',
    'hud.key_right_click': 'R-CLICK',

    // Extraction & Death Screens
    'extraction.title': 'EXTRACTION SUCCESSFUL!',
    'extraction.subtitle': 'You survived and secured your loot.',
    'extraction.loot_title': '--- EXTRACTED DUNGEON LOOT ---',
    'extraction.empty_loot': 'No equipment carried back.',
    'death.title': 'YOU DIED',
    'death.subtitle': 'The Citadel claimed your soul...',
    'spectator.mode': 'SPECTATOR MODE:',
    'spectator.adventurer': 'Adventurer',
    'spectator.help': '([Left/Right Click] or Arrows [◀] / [▶] to switch teammate | [R] Return to camp)',
    'spectator.no_teammates': 'No living teammates to spectate.',

    // Merchant Modal
    'merchant.title': 'THE STRANGE CRYPT MERCHANT',
    'merchant.subtitle': '« The cards of destiny open before you... Choose only one wisely. »',
    'merchant.footer': '✦ Pick ONE mystery card to reveal (others will be sealed) ✦',
    'merchant.revealed': 'REVEALED!',
    'merchant.sealed': 'SEALED',
    'merchant.pick': 'CLICK TO REVEAL',

    // Hub Tabs
    'hub.tab_play': 'PLAY',
    'hub.tab_equipment': 'EQUIPMENT',
    'hub.tab_ladder': 'RANKINGS',
    'hub.tab_shop': 'SHOP',
    'hub.tab_quests': 'QUESTS',
    'hub.soon': 'SOON',

    // Hub Play View
    'hub.play_title': 'HERO PREPARATION',
    'hub.play_subtitle': 'Check your equipped gear and attributes before entering the Citadel.',
    'hub.body_gear': 'BODY EQUIPMENT',
    'hub.attributes': 'ATTRIBUTES & STATS',
    'hub.empty_slot': 'Empty',
    'hub.stat_gearscore': '⭐ Gear Score',
    'hub.stat_health': '💖 Health',
    'hub.stat_damage': '🗡️ Damage',
    'hub.stat_magic': '🔮 Magic Power',
    'hub.stat_defense': '🛡️ Defense',
    'hub.stat_speed': '💨 Move Speed',
    'hub.stat_cast': '⚡ Cast Speed',
    'hub.stat_stealth': '👤 Stealth',
    'hub.stat_charisma': '👑 Charisma',

    // Hub Equipment View
    'hub.equipped_title': 'EQUIPPED ITEMS',
    'hub.stash_title': 'ITEM STASH',
    'hub.hero_stats_title': 'HERO ATTRIBUTES',
    'hub.stash_empty': 'Your stash is empty. Extract with loot to store items here!',

    // Hub Ladder View
    'hub.ladder_title': 'ADVENTURERS HALL OF FAME (LADDER)',
    'hub.ladder_subtitle': 'Official Citadel rankings sorted by maximum Gear Score reached by each explorer.',
    'hub.ladder_rank': 'RANK',
    'hub.ladder_adventurer': 'ADVENTURER',
    'hub.ladder_max_gs': 'MAX GEAR SCORE',
    'hub.ladder_tier': 'POWER TIER',
    'hub.ladder_extractions': 'EXTRACTIONS',
    'hub.ladder_monsters': 'MONSTERS',
    'hub.ladder_you': 'YOU',
    'hub.ladder_empty': 'No ranked adventurers recorded yet.',
    'hub.ladder_loading': 'Loading official rankings...',
    'hub.ladder_error': 'Leaderboard offline (Database unreachable).',

    // Hub Shop View
    'hub.upgrades_title': 'PERMANENT UPGRADES (TALENT TREE)',
    'hub.shop_items_title': 'SHOP ARSENAL',
    'hub.cost': 'Cost: {cost} 🪙',
    'hub.max_level': 'MAX LEVEL',
    'hub.level': 'Level {level} / {max}',

    // Hub Quests View
    'hub.quests_title': 'CONTRACTS & QUESTS REGISTRY',
    'hub.quests_subtitle': 'Complete feats during your expeditions to earn gold coin rewards.',
    'hub.quest_progress': 'Progress: {current} / {target}',
    'hub.reward': 'Reward: +{reward} 🪙',

    // Hub Matchmaking Queue
    'queue.tag': 'CITADEL',
    'queue.title': 'PREPARATION',
    'queue.subtitle': 'Expeditions to the Citadel depart every minute. All waiting adventurers will be teleported together into the same session.',
    'queue.searching': 'SEARCHING FOR ADVENTURERS...',
    'queue.departure': 'Departure guaranteed when timer expires.',
    'queue.convoy_title': 'ADVENTURERS IN CONVOY',
    'queue.ready_count': '{count} / 4 READY',
    'queue.ready': 'READY',
    'queue.waiting': 'WAITING...',

    // Auth Modal
    'auth.title_login': 'CONNECT TO THE CITADEL',
    'auth.title_register': 'JOIN THE CITADEL',
    'auth.subtitle': 'Save your items, gold coins and stats to the database',
    'auth.tab_login': 'LOG IN',
    'auth.tab_register': 'REGISTER',
    'auth.username_label': 'ADVENTURER NAME',
    'auth.username_placeholder': 'e.g. ShadowHunter',
    'auth.password_label': 'PASSWORD',
    'auth.password_placeholder': 'At least 6 characters',
    'auth.disclaimer': '⚠️ In Guest Mode, you can play without an account, but your items and coins will not be preserved when you leave.',
    'auth.connected_tag': 'CONNECTED ADVENTURER',
    'auth.sync_status': 'Cloud Save active',
    'auth.err_empty': 'Please fill in both adventurer name and password.',
    'auth.err_username_length': 'Name must be between 3 and 20 characters.',
    'auth.err_username_chars': 'Name may only contain letters, numbers, hyphens and underscores.',
    'auth.err_password_length': 'Password must be at least 6 characters.',

    // Chat
    'chat.placeholder': "Squad message... (Enter to send, Esc to cancel)",

    // Equipment Slots
    'slot.hat': 'HAT',
    'slot.weapon': 'WEAPON',
    'slot.armor': 'ARMOR',
    'slot.boots': 'BOOTS',
    'slot.key': 'KEY',
    'slot.offhand': 'OFFHAND',

    // Rarities
    'rarity.common': 'COMMON',
    'rarity.uncommon': 'UNCOMMON',
    'rarity.rare': 'RARE',
    'rarity.epic': 'EPIC',
    'rarity.legendary': 'LEGENDARY',
    'rarity.artifact': 'ARTIFACT',

    // Gear Score Tiers
    'tier.beginner': 'Beginner',
    'tier.novice': 'Novice',
    'tier.initiate': 'Initiate',
    'tier.adventurer': 'Adventurer',
    'tier.veteran': 'Veteran',
    'tier.champion': 'Champion',
    'tier.master': 'Master',
    'tier.legend': 'Legend',

    // Item Tooltip & Comparison
    'tooltip.power': '⭐ POWER : {score}',
    'tooltip.equipped': 'EQUIPPED',
    'tooltip.press_f': 'Press [F] to equip / unequip',
    'tooltip.drag': 'Click to equip in body slot',

    // Interaction Prompts & Feedback
    'prompt.open_chest': 'Press [F] to open chest',
    'prompt.open_door': 'Press [F] to open heavy gate',
    'prompt.talk_merchant': 'Press [F] to talk to the Merchant',
    'prompt.extraction_portal': 'Press [F] to step into the Extraction Portal',
    'prompt.pick_coin': 'Press [F] to pick up coins (+{amount} 🪙)',
    'prompt.pick_item': 'Press [F] to pick up {name}',
    'prompt.chest_boss_locked': 'Chest sealed until the Boss is defeated!',
    'prompt.portal_boss_locked': 'Portal sealed until the Sanctuary Boss is defeated!',
    'prompt.door_key_required': 'Skull Key required to unlock this iron gate!',
    'prompt.spawn_door_key_required': 'Zone Key required to unlock this iron gate!',
    'prompt.homonculus_dissolved': 'The Homonculus dissolved upon leaving the crypts.',
    'prompt.obtained_item': 'OBTAINED: {name}!',
    'prompt.hit_by_fireball': '💥 HIT BY A FIREBALL! (-{damage} HP)',
    'prompt.tactical_ping': '📍 TACTICAL PING PLACED!',
    'prompt.abandoned': 'EXPEDITION ABANDONED: GEAR LOST!',
    'prompt.boss_slain': '👑 SANCTUARY BOSS DEFEATED! Extraction portal & royal chests unlocked!',
    'prompt.player_left': '🚪 {name} left the Citadel.',
    'prompt.player_joined': '⚔️ {name} stepped into the Citadel.',

    // Upgrades
    'upgrade.vitality.name': 'Titan Heart',
    'upgrade.vitality.desc': 'Permanently strengthens your vital endurance.',
    'upgrade.vitality.effect': '+15 Max HP per level',

    'upgrade.power.name': 'Arcane Strength',
    'upgrade.power.desc': 'Increases the damage of your spells and fireballs.',
    'upgrade.power.effect': '+3 Base Damage per level',

    'upgrade.defense.name': 'Runic Cuirass',
    'upgrade.defense.desc': 'Reduces physical and magical damage taken.',
    'upgrade.defense.effect': '+1 Flat Defense per level',

    'upgrade.speed.name': 'Hermes Swiftness',
    'upgrade.speed.desc': 'Increases your walking and strafing movement speed.',
    'upgrade.speed.effect': '+5% Move Speed per level',

    'upgrade.casting.name': 'Magic Surge',
    'upgrade.casting.desc': 'Reduces the cooldown and casting delay of your spells.',
    'upgrade.casting.effect': '+8% Cast Speed per level',

    // Quests
    'quest.kills.title': 'Monster Exterminator',
    'quest.kills.desc': 'Slay corrupt creatures haunting the dungeon corridors.',
    'quest.chests.title': 'Tomb Raider',
    'quest.chests.desc': 'Open treasure chests hidden throughout the dungeon.',
    'quest.bosses.title': 'Ruler Slayer',
    'quest.bosses.desc': 'Defeat a Sanctuary Boss (Blood Queen or Cake King).',
    'quest.goblins.title': 'Greedy Interceptor',
    'quest.goblins.desc': 'Prevent a Treasure Goblin from escaping by slaying it.',
    'quest.richExtraction.title': 'The Great Escape',
    'quest.richExtraction.desc': 'Successfully extract while securing at least 25 gold coins.',

    // Skins
    'skin.puzzle_lord.name': 'Lord Enigmatic',
    'skin.puzzle_lord.title': 'LORD OF THE ARCANES',
    'skin.gouter_lord.name': 'Lord Gluttonous',
    'skin.gouter_lord.title': 'LORD OF CAKES',
  },
  fr: {
    // App & Titre
    'app.title': 'The Old Citadel (TOC) • Dungeon Extraction PvPvE',
    'app.tagline': 'DUNGEON EXTRACTION RPG • PVPVE',
    'app.loading': 'INITIALISATION DES ARCANES DE LA CITADELLE...',
    'app.loading_footer': 'CHARGEMENT DE LA CITADELLE EN COURS',
    'app.ready': "Prêt pour l'expédition !",

    // Boutons et Actions communs
    'btn.play': 'JOUER',
    'btn.resume': 'REPRENDRE',
    'btn.settings': 'PARAMÈTRES',
    'btn.back': 'RETOUR',
    'btn.cancel': 'ANNULER',
    'btn.close': 'FERMER',
    'btn.continue': 'CONTINUER',
    'btn.refresh': 'ACTUALISER',
    'btn.login': 'SE CONNECTER',
    'btn.register': "S'INSCRIRE",
    'btn.logout': 'SE DÉCONNECTER',
    'btn.guest': 'JOUER EN MODE INVITÉ',
    'btn.equip': 'ÉQUIPER',
    'btn.unequip': 'DÉSÉQUIPER',
    'btn.stash': 'STOCKER',
    'btn.take': 'PRENDRE',
    'btn.upgrade': 'AMÉLIORER',
    'btn.claim': 'RÉCUPÉRER',
    'btn.claimed': 'RÉCLAMÉE',
    'btn.launch': 'LANCER LA PARTIE',
    'btn.cancel_queue': '✕ ANNULER ET RETOURNER AU CAMPEMENT [ÉCHAP]',
    'btn.abandon': "ABANDONNER L'EXPÉDITION (MORT)",
    'btn.main_menu': 'MENU PRINCIPAL (MORT)',
    'btn.return_camp': 'RETOURNER AU CAMPEMENT [R]',
    'btn.spectate': "👁️ REGARDER L'ESCOUADE [V]",

    // Menu Principal
    'menu.login_register': "SE CONNECTER / S'INSCRIRE",
    'menu.ladder': 'CLASSEMENT (LADDER)',
    'menu.settings': 'PARAMÈTRES',
    'menu.guest_badge': 'Mode Invité (sauvegarde inactive)',
    'menu.guest_tooltip': 'Connectez-vous pour sauvegarder votre butin et votre or sur la base de données.',
    'menu.connected_badge': '🛡️ Aventurier : {name} (Sauvegarde active)',
    'menu.connected_tooltip': 'Connecté en tant que {name}. Cliquez pour gérer votre compte.',

    // Paramètres
    'settings.title': 'PARAMÈTRES',
    'settings.fov': 'CHAMP DE VISION (FOV)',
    'settings.fov_zoom': '60° (ZOOM)',
    'settings.fov_wide': '110° (LARGE)',
    'settings.keyboard': 'DISPOSITION DU CLAVIER',
    'settings.language': 'LANGUE / LANGUAGE',
    'settings.audio': 'RÉGLAGES AUDIO',
    'settings.music_on': 'MUSIQUE : ACTIVE',
    'settings.music_off': 'MUSIQUE : COUPÉE',
    'settings.sfx_on': 'EFFETS : ACTIFS',
    'settings.sfx_off': 'EFFETS : COUPÉS',
    'settings.sound_active': 'SON ACTIF',
    'settings.sound_muted': 'SONS COUPÉS',
    'settings.sound_partial': 'PARTIEL',
    'settings.controls_title': '✦ COMMANDES DU JEU ✦',
    'settings.ctrl_move': 'Avancer / Reculer',
    'settings.ctrl_strafe': 'Strafe Gauche / Droite',
    'settings.ctrl_mouse': 'Orienter la vue',
    'settings.ctrl_fireball': 'Boule de Feu',
    'settings.ctrl_orb': 'Orbe Violet Rebondissant',
    'settings.ctrl_interact': 'Interagir (Coffres, Portes, Marchand)',
    'settings.ctrl_pause': 'Menu Pause en jeu',

    // HUD & Sorts
    'hud.health': 'PV {current} / {max}',
    'hud.spell_primary_title': 'Sort Primaire : Boule de Feu [Clic G / Espace]',
    'hud.spell_secondary_title': 'Sort Secondaire : Orbe Rebondissant [Clic Droit] — +50% de dégâts par rebond !',
    'hud.zone_default': 'ZONE 1 - QUARTIER DE DÉPART',
    'hud.key_left_click': 'CLIC G',
    'hud.key_right_click': 'CLIC D',

    // Écrans Extraction & Mort
    'extraction.title': 'EXTRACTION REUSSIE !',
    'extraction.subtitle': 'Vous avez survécu et sécurisé votre butin.',
    'extraction.loot_title': '--- BUTIN EXTRAIT DU DONJON ---',
    'extraction.empty_loot': 'Aucun équipement rapporté.',
    'death.title': 'VOUS ÊTES MORT',
    'death.subtitle': 'La Citadelle a réclamé votre âme...',
    'spectator.mode': 'MODE SPECTATEUR :',
    'spectator.adventurer': 'Aventurier',
    'spectator.help': "([Clics G/D] ou Flèches [◀] / [▶] pour changer d'équipier | [R] Retour au campement)",
    'spectator.no_teammates': 'Aucun coéquipier vivant à observer.',

    // Modal Marchand
    'merchant.title': "L'ÉTRANGE MARCHAND DES CRYPTES",
    'merchant.subtitle': '« Les cartes du destin s\'ouvrent à vous... Choisissez-en une seule avec sagesse. »',
    'merchant.footer': '✦ Choisissez UNE seule carte mystère à retourner (les autres seront scellées) ✦',
    'merchant.revealed': 'RÉVÉLÉE !',
    'merchant.sealed': 'SCELLÉE',
    'merchant.pick': 'CLIQUER POUR RÉVÉLER',

    // Onglets Hub
    'hub.tab_play': 'JOUER',
    'hub.tab_equipment': 'ÉQUIPEMENT',
    'hub.tab_ladder': 'CLASSEMENT',
    'hub.tab_shop': 'BOUTIQUE',
    'hub.tab_quests': 'QUÊTES',
    'hub.soon': 'BIENTÔT',

    // Vue Jouer Hub
    'hub.play_title': 'PRÉPARATION DU HÉROS',
    'hub.play_subtitle': "Vérifiez vos équipements anatomiques et vos attributs avant d'entrer dans la Citadelle.",
    'hub.body_gear': 'ÉQUIPEMENT DU CORPS',
    'hub.attributes': 'ATTRIBUTS & STATISTIQUES',
    'hub.empty_slot': 'Vide',
    'hub.stat_gearscore': '⭐ Gear Score',
    'hub.stat_health': '💖 Santé Max',
    'hub.stat_damage': '🗡️ Dégâts',
    'hub.stat_magic': '🔮 Puiss. Magique',
    'hub.stat_defense': '🛡️ Défense',
    'hub.stat_speed': '💨 Vit. Déplacement',
    'hub.stat_cast': '⚡ Vit. Incantation',
    'hub.stat_stealth': '👤 Discrétion',
    'hub.stat_charisma': '👑 Charisme',

    // Vue Équipement Hub
    'hub.equipped_title': 'OBJETS ÉQUIPÉS',
    'hub.stash_title': "RÉSERVE D'ÉQUIPEMENT (STASH)",
    'hub.hero_stats_title': 'STATISTIQUES DU HÉROS',
    'hub.stash_empty': 'Votre réserve est vide. Extrayez du donjon pour stocker vos objets ici !',

    // Vue Ladder Hub
    'hub.ladder_title': 'PANTHÉON DES AVENTURIERS (LADDER)',
    'hub.ladder_subtitle': 'Classement officiel de la Citadelle selon le Gear Score maximum atteint par chaque explorateur.',
    'hub.ladder_rank': 'RANG',
    'hub.ladder_adventurer': 'AVENTURIER',
    'hub.ladder_max_gs': 'GEAR SCORE MAX',
    'hub.ladder_tier': 'RANG DE PUISSANCE',
    'hub.ladder_extractions': 'EXTRACTIONS',
    'hub.ladder_monsters': 'MONSTRES',
    'hub.ladder_you': 'VOUS',
    'hub.ladder_empty': 'Aucun aventurier classé pour le moment.',
    'hub.ladder_loading': 'Chargement du classement officiel...',
    'hub.ladder_error': 'Classement hors-ligne (Base de données injoignable).',

    // Vue Boutique Hub
    'hub.upgrades_title': 'AMÉLIORATIONS PERMANENTES (ARBRE DE TALENTS)',
    'hub.shop_items_title': 'ARSENAL DE LA BOUTIQUE',
    'hub.cost': 'Coût : {cost} 🪙',
    'hub.max_level': 'NIVEAU MAX',
    'hub.level': 'Niveau {level} / {max}',

    // Vue Quêtes Hub
    'hub.quests_title': 'REGISTRE DES CONTRATS & QUÊTES',
    'hub.quests_subtitle': 'Accomplissez des exploits lors de vos expéditions pour décrocher des récompenses en pièces d\'or.',
    'hub.quest_progress': 'Progression : {current} / {target}',
    'hub.reward': 'Récompense : +{reward} 🪙',

    // File d'Attente Matchmaking Hub
    'queue.tag': 'CITADELLE',
    'queue.title': 'PRÉPARATION',
    'queue.subtitle': "L'expedition vers la Citadelle part toutes les minutes. Tous les aventuriers en attente seront téléportés ensemble dans la même session.",
    'queue.searching': "RECHERCHE D'AVENTURIERS EN COURS...",
    'queue.departure': "Départ garanti dès l'expiration du chrono.",
    'queue.convoy_title': 'AVENTURIERS DANS LE CONVOI',
    'queue.ready_count': '{count} / 4 PRÊTS',
    'queue.ready': 'PRÊT',
    'queue.waiting': 'EN ATTENTE...',

    // Modal Authentification
    'auth.title_login': 'CONNEXION À LA CITADELLE',
    'auth.title_register': "INSCRIPTION À LA CITADELLE",
    'auth.subtitle': 'Sauvegardez vos objets, pièces d\'or et statistiques sur la base de données',
    'auth.tab_login': 'SE CONNECTER',
    'auth.tab_register': "S'INSCRIRE",
    'auth.username_label': "NOM D'AVENTURIER",
    'auth.username_placeholder': 'Ex: ShadowHunter',
    'auth.password_label': 'MOT DE PASSE',
    'auth.password_placeholder': 'Au moins 6 caractères',
    'auth.disclaimer': '⚠️ En Mode Invité, vous pouvez jouer sans compte, mais vos objets et vos pièces ne seront pas conservés si vous quittez la session.',
    'auth.connected_tag': 'AVENTURIER CONNECTÉ',
    'auth.sync_status': 'Sauvegarde active',
    'auth.err_empty': "Veuillez renseigner un nom d'aventurier et un mot de passe.",
    'auth.err_username_length': "Le pseudonyme doit contenir entre 3 et 20 caractères.",
    'auth.err_username_chars': 'Le pseudonyme ne peut contenir que des lettres, chiffres, tirets et underscores.',
    'auth.err_password_length': 'Le mot de passe doit comporter au moins 6 caractères.',

    // Chat
    'chat.placeholder': "Message à l'escouade... (Entrée pour envoyer, Échap pour annuler)",

    // Emplacements d'équipement
    'slot.hat': 'CHAPEAU',
    'slot.weapon': 'ARME',
    'slot.armor': 'ARMURE',
    'slot.boots': 'BOTTES',
    'slot.key': 'CLÉ',
    'slot.offhand': 'MAIN GAUCHE',

    // Raretés
    'rarity.common': 'COMMUN',
    'rarity.uncommon': 'NON COMMUN',
    'rarity.rare': 'RARE',
    'rarity.epic': 'ÉPIQUE',
    'rarity.legendary': 'LÉGENDAIRE',
    'rarity.artifact': 'ARTÉFACT',

    // Paliers de Gear Score
    'tier.beginner': 'Débutant',
    'tier.novice': 'Novice',
    'tier.initiate': 'Initié',
    'tier.adventurer': 'Aventurier',
    'tier.veteran': 'Vétéran',
    'tier.champion': 'Champion',
    'tier.master': 'Maître',
    'tier.legend': 'Légende',

    // Infobulle d'équipement
    'tooltip.power': '⭐ PUISSANCE : {score}',
    'tooltip.equipped': 'ÉQUIPÉ',
    'tooltip.press_f': 'Appuyez sur [F] pour équiper / déséquiper',
    'tooltip.drag': 'Cliquez pour équiper sur le corps',

    // Interactions & Retours en jeu
    'prompt.open_chest': 'Appuyez sur [F] pour ouvrir le coffre',
    'prompt.open_door': 'Appuyez sur [F] pour ouvrir la lourde herse',
    'prompt.talk_merchant': 'Appuyez sur [F] pour parler au Marchand',
    'prompt.extraction_portal': "Appuyez sur [F] pour emprunter le Portail d'Extraction",
    'prompt.pick_coin': 'Appuyez sur [F] pour ramasser les pièces (+{amount} 🪙)',
    'prompt.pick_item': 'Appuyez sur [F] pour ramasser {name}',
    'prompt.chest_boss_locked': "Le coffre est scellé tant que le Boss n'a pas été vaincu !",
    'prompt.portal_boss_locked': "Le portail est scellé tant que le Boss n'a pas été vaincu !",
    'prompt.door_key_required': 'Clé en Os de la Crypte requise pour ouvrir cette herse !',
    'prompt.spawn_door_key_required': 'Clé Rouillée requise pour ouvrir cette herse !',
    'prompt.homonculus_dissolved': "L'Homonculus s'est dissous en quittant les cryptes.",
    'prompt.obtained_item': 'OBTENU : {name} !',
    'prompt.hit_by_fireball': '💥 TOUCHÉ PAR UNE BOULE DE FEU ! (-{damage} PV)',
    'prompt.tactical_ping': '📍 SIGNAL TACTIQUE PLACÉ !',
    'prompt.abandoned': 'EXPÉDITION ABANDONNÉE : ÉQUIPEMENTS PERDUS !',
    'prompt.boss_slain': '👑 BOSS DE SANCTUAIRE VAINCU ! Portail et coffres royaux déverrouillés !',
    'prompt.player_left': '🚪 {name} a quitté la Citadelle.',
    'prompt.player_joined': '⚔️ {name} a rejoint la Citadelle.',

    // Améliorations
    'upgrade.vitality.name': 'Cœur de Titan',
    'upgrade.vitality.desc': 'Renforce votre endurance vitale de manière permanente.',
    'upgrade.vitality.effect': '+15 PV Max par niveau',

    'upgrade.power.name': 'Force Arcanique',
    'upgrade.power.desc': 'Augmente les dégâts de vos sorts et boules de feu.',
    'upgrade.power.effect': '+3 Dégâts de base par niveau',

    'upgrade.defense.name': 'Cuirasse Runique',
    'upgrade.defense.desc': 'Réduit les dégâts physiques et magiques subis.',
    'upgrade.defense.effect': '+1 Défense brute par niveau',

    'upgrade.speed.name': 'Célérité d’Hermès',
    'upgrade.speed.desc': 'Accélère votre vitesse de marche et de strafe.',
    'upgrade.speed.effect': '+5% Vitesse de déplacement par niveau',

    'upgrade.casting.name': 'Afflux Magique',
    'upgrade.casting.desc': 'Diminue le temps de recharge de vos sorts.',
    'upgrade.casting.effect': '+8% Vitesse d’incantation par niveau',

    // Quêtes
    'quest.kills.title': 'Exterminateur de Monstres',
    'quest.kills.desc': 'Éliminez les créatures corrompues qui hantent les couloirs.',
    'quest.chests.title': 'Pilleur de Tombes',
    'quest.chests.desc': 'Ouvrez les coffres au trésor dissimulés dans le donjon.',
    'quest.bosses.title': 'Tueur de Souverain',
    'quest.bosses.desc': 'Terrassez un Boss de Sanctuaire (Reine de Sang ou Roi Gâteau).',
    'quest.goblins.title': 'Intercepteur Cupide',
    'quest.goblins.desc': 'Empêchez un Gobelin au Trésor de fuir en l’éliminant.',
    'quest.richExtraction.title': 'Grand Évadé',
    'quest.richExtraction.desc': 'Réussissez une extraction en sécurisant au moins 25 pièces.',

    // Skins
    'skin.puzzle_lord.name': 'Lord Énigmatique',
    'skin.puzzle_lord.title': 'SEIGNEUR DES ARCANES',
    'skin.gouter_lord.name': 'Lord Gourmand',
    'skin.gouter_lord.title': 'SEIGNEUR DES GÂTEAUX',
  },
};

const ITEM_TRANSLATIONS: Record<Language, Record<string, ItemTranslation>> = {
  en: {
    hat_leech_infested_mitre: {
      name: 'Leech-Infested Decrepit Mitre',
      effect: 'Pious leeches suck your forehead while you mutter desperate prayers.',
      description: 'Retrieved from the bottom of a flooded sarcophagus. Rancid incense scent chased away holiness long ago.',
    },
    hat_myopic_necromancer: {
      name: 'Short-Sighted Necromancer Pointed Hat',
      effect: 'Vaguely illuminates dark thoughts within a 2 meter radius.',
      description: 'Woven from the fur of an insomniac bat. Stubbornly tilts over your left eye during incantations.',
    },
    weapon_arthritic_lich_staff: {
      name: 'Arthritic Lich Crooked Staff',
      effect: 'Fireballs smell of stale sulfur and make enemy joints crack.',
      description: 'Carved from the femur of a grumpy demon. Equally useful for forbidden curses and scratching your shoulder blades.',
    },
    weapon_crooked_phylactery_dagger: {
      name: 'Curse of the Broken Phylactery Dagger',
      effect: 'Whispers cosmic secrets that confuse anyone stepping too close.',
      description: 'Forged from the shattered glass of a funerary urn. The blade pulses with forbidden yellow embers.',
    },
    armor_moldy_hermit_rags: {
      name: 'Moldy Hermit Rags',
      effect: 'Releases a cloud of mold spores dampening footstep echoes.',
      description: 'Tattered rags patched together with linen twine and crypt moss.',
    },
    armor_shrunk_black_mass_robe: {
      name: 'Shrunk Black Mass Robe',
      effect: 'Absorbs 12% of ambient curses and 100% of crypt dampness.',
      description: 'Soaked in abyssal gloom and lingering damp basement scent. Itches horribly around the elbows.',
    },
    boots_squeaky_abyss_poulaines: {
      name: 'Squeaky Abyssal Poulaines',
      effect: 'Emits an intimidating "squeak" that distracts specters with every stride.',
      description: 'Crafted from the leather of an asthmatic gargoyle. Emits a tiny funeral squeak with each step in the crypts.',
    },
    boots_slippery_graveyard_clogs: {
      name: 'Gravedigger Slippery Clogs',
      effect: 'Allows gliding over crypt slime at astonishing speed.',
      description: 'Hastily carved from cypress wood. Soles polished smooth by centuries of sepulchral muck.',
    },
    key_crypt_skull: {
      name: 'Crypt Bone Skull Key',
      effect: 'Unlocks the heavy iron portcullis sealing the secret crypt sanctum.',
      description: 'Carved from an ancient femur and crested with a hollow skull. A sinister rattle echoes when shaken.',
    },
    key_spawn_rusty: {
      name: 'Rusty Quarter Key',
      effect: 'Unlocks the heavy portcullis sealing your starting district to the central ring.',
      description: 'A crude key eaten away by crypt rust and mold. Smells of cold, oxidized iron.',
    },
    weapon_splintered_apprentice_wand: {
      name: 'Splintered Apprentice Wand',
      effect: 'Delivers minor static electric shocks straight into your knuckles.',
      description: 'A crooked hazel branch covered in clumsy esoteric carvings.',
    },
    armor_tattered_gambeson: {
      name: 'Forgotten Guard Tattered Gambeson',
      effect: 'Cushions superficial claw scratches at the cost of moldy straw padding.',
      description: 'Worn by a town militia guard who fell three centuries ago. Warm, but hosts several moth families.',
    },
    boots_cobbled_grave_treaders: {
      name: 'Graverobber Cobbled Boots',
      effect: 'Iron studs scrape loudly against the damp dungeon flagstones.',
      description: 'Leather toughened with pig grease. Soles encrusted with shards of tomb bones.',
    },
    hat_ragged_scavenger_cowl: {
      name: 'Scavenger Ragged Cowl',
      effect: 'Shrouds your facial features in shadow to evade inquisitive gazes.',
      description: 'Dark coarse homespun patched with dried sinew. Shields eyes from burning torch soot.',
    },
    armor_cursed_bone_carapace: {
      name: 'Abyssal Skeletal Carapace',
      effect: 'Spectral ribcage tightens around you to deflect deadly strikes.',
      description: 'Ritual assemblage of cursed titan vertebrae, sealed with necrotic resin.',
    },
    offhand_homonculus: {
      name: 'Homonculus',
      effect: 'Detects the closest treasure chests through walls. Cannot be extracted from the dungeon.',
      description: 'An alchemical homunculus held in the left hand. Shivers and points toward hidden chests. Bound to the crypt energies, it dissolves if you try to extract with it.',
    },
    weapon_gnarled_cemetery_branch: {
      name: 'Gnarled Cemetery Branch',
      effect: 'Whips the air with the dry snap of splintering bone.',
      description: 'Torn from an ancient yew tree feeding on pauper graves. Sticky with crimson sap.',
    },
    weapon_crypt_grave_digger_shovel: {
      name: 'Fanatic Gravedigger Sharpened Shovel',
      effect: 'Impacts resound like a shovel of fresh earth dumped onto a coffin.',
      description: 'Handle worn smooth by decades of midnight toil. The steel edge has beheaded many stubborn ghouls.',
    },
    armor_iron_inquisitor_hauberk: {
      name: 'Notched Inquisitor Hauberk',
      effect: 'Blessed steel mail rings out softly to dispel minor spectral apparitions.',
      description: 'Forged in a penitence furnace. Still bears the blackened scorch marks of purifying pyres.',
    },
    hat_plague_doctor_beak: {
      name: 'Pestilent Doctor Beaked Mask',
      effect: 'Filters putrid miasmas but forces you to breathe with a terrifying death rattle.',
      description: 'Boiled leather soaked in four-thieves vinegar and dried herbs that never cured anything.',
    },
    weapon_soul_reaper_athame: {
      name: 'Soul Reaper Athame',
      effect: 'Victims let out a ghostly wail that fills your mystical vials.',
      description: 'A ritual black-silver dagger engraved with spirit-binding runes. Pulses with hunger near flesh.',
    },
    boots_specter_phase_treads: {
      name: 'Spectral Phase Treads',
      effect: 'Leaves a faint trail of freezing ectoplasmic mist that baffles pursuers.',
      description: 'Woven from shrowds of restless souls. They never quite touch the crypt floor.',
    },
    hat_crown_of_thousand_skulls: {
      name: 'Horned Diadem of the Undead Prince',
      effect: 'An aura of necrotic terror radiates from your brow, intimidating nearby monsters.',
      description: 'Crown forged of blackened tomb gold, set with a ruby that pulses like a frozen heart.',
    },
    boots_hellfire_conqueror_greaves: {
      name: 'Cursed Blaze Conqueror Greaves',
      effect: 'Each step leaves a pool of spectral embers on sepulchral tiles.',
      description: 'Thick iron plates forged in deepest catacomb fire. Heavy, but ferociously grounded.',
    },
    armor_aegis_of_the_undying: {
      name: 'Titans Aegis of the Undying',
      effect: 'An obsidian ribcage absorbs mortal blows and restores your vital breath.',
      description: 'Forged before the First Citadel collapsed by forgotten artisans. Shields its bearer even beyond death.',
    },
    hat_halo_of_the_void_sovereign: {
      name: 'Broken Halo of the Void Sovereign',
      effect: 'Cosmic shards levitate above your skull, dramatically magnifying spell potency.',
      description: 'Cosmic relic pried from a fallen deity. Its violet radiance resonates with the fabric of reality.',
    },
    boots_void_strider_sandals: {
      name: 'Celestial Sandals of the Void Strider',
      effect: 'Glide on ethereal currents, reducing physical ground friction to nothingness.',
      description: 'Braided from filaments of dead stars. Walking with them feels like drifting across centuries.',
    },
  },
  fr: {
    hat_leech_infested_mitre: {
      name: 'Mitre Décrépite Infestée de Sangsues',
      effect: 'Des sangsues pieuses vous sucent le front pendant que vous marmonnez des prières.',
      description: "Récupérée au fond d'un sarcophage inondé. L'odeur d'encens rance a depuis longtemps chassé la sainteté.",
    },
    hat_myopic_necromancer: {
      name: 'Chapeau Pointu du Nécromancien Myope',
      effect: 'Éclaire vaguement les pensées sombres dans un rayon de 2 mètres.',
      description: "Tissé en poils de chauve-souris insomniaque. Penche obstinément devant l'œil gauche pendant les incantations.",
    },
    weapon_arthritic_lich_staff: {
      name: 'Bâton Tordu de la Liche Arthritique',
      effect: 'Les boules de feu sentent le vieux soufre et font craquer les articulations des ennemis.',
      description: "Taillé dans un fémur de démon grognon. Sert autant à lancer des malédictions interdites qu'à se gratter entre les omoplates.",
    },
    weapon_crooked_phylactery_dagger: {
      name: 'Dague Maudite du Phylactère Brisé',
      effect: "Murmure des secrets cosmiques qui rendent confus quiconque s'en approche.",
      description: "Forgée dans le verre d'une urne funéraire brisée. La lame palpite d'un éclat jaune interdit.",
    },
    armor_moldy_hermit_rags: {
      name: 'Loques Moisies du Solitaire',
      effect: 'Dégage un nuage de spores de moisissure camouflant les pas.',
      description: 'Des loques rapiécées avec de la ficelle de lin et de la mousse de tombeau.',
    },
    armor_shrunk_black_mass_robe: {
      name: 'Robe de Messe Noire Rétrécie au Lavage',
      effect: 'Absorbe 12% des malédictions ambiantes et 100% de l\'humidité des cryptes.',
      description: "Imprégnée de ténèbres abyssales et d'une tenace odeur de cave humide. Gratte atrocement aux coudes.",
    },
    boots_squeaky_abyss_poulaines: {
      name: 'Poulaines Maudites qui Couinent',
      effect: 'Émet un « pouic » intimidant qui déconcentre les spectres à chaque foulée.',
      description: "Forgées dans le cuir d'une gargouille asthmatique. Font un petit « pouic » funèbre à chaque pas dans les cryptes.",
    },
    boots_slippery_graveyard_clogs: {
      name: 'Sabots Glissants du Fossoyeur',
      effect: 'Permet de glisser sur la vase des cryptes à une allure prodigieuse.',
      description: 'Sabots en bois de cyprès taillés à la hâte. La semelle est polie par des siècles de gadoue sépulcrale.',
    },
    key_crypt_skull: {
      name: 'Clé en Os de la Crypte',
      effect: 'Déverrouille la lourde herse de fer scellant la crypte secrète.',
      description: "Taillée dans un fémur antique et ornée d'un crâne au regard vide. Un cliquetis sinistre résonne quand on l'agite.",
    },
    key_spawn_rusty: {
      name: 'Clé Rouillée du Quartier',
      effect: "Déverrouille la herse de fer scellant votre zone de départ vers l'anneau central.",
      description: 'Une clé grossière rongée par la rouille et les moisissures des cryptes. Elle sent le vieux fer froid.',
    },
    weapon_splintered_apprentice_wand: {
      name: "Baguette Écharde de l'Initié",
      effect: 'Donne de légères décharges d\'électricité statique dans les phalanges.',
      description: 'Une branche de noisetier mal équarrie recouverte de gravures ésotériques maladroites.',
    },
    armor_tattered_gambeson: {
      name: 'Gambison Déchiré de Garde Oublié',
      effect: 'Amortit les coups de griffe superficiels au prix d\'un rembourrage en paille miteuse.',
      description: 'Porté par un milicien mort il y a trois siècles. Tient chaud mais abrite plusieurs familles de mites.',
    },
    boots_cobbled_grave_treaders: {
      name: 'Bottes Cloutées du Pilleur de Tombes',
      effect: 'Les clous en fer crissent sur les dalles humides du donjon.',
      description: "Cuir durci à la graisse de porc. Les semelles sont incrustées de débris d'ossements sépulcraux.",
    },
    hat_ragged_scavenger_cowl: {
      name: 'Capuchon Déguenillé du Charognard',
      effect: "Dissimule les traits du visage dans l'obscurité pour échapper aux regards inquisiteurs.",
      description: 'Tissu de bure sombre rapiécé avec des tendons séchés. Protège de la suie des torches.',
    },
    armor_cursed_bone_carapace: {
      name: 'Carapace Squelettique des Abysses',
      effect: 'Des côtes spectrales se resserrent autour de vous pour dévier les assauts meurtriers.',
      description: 'Assemblage rituel de vertèbres de titans maudits, scellées ensemble par de la résine nécrotique.',
    },
    offhand_homonculus: {
      name: 'Homonculus',
      effect: 'Détecte les coffres les plus proches à travers les murs. Ne peut pas être extrait du niveau.',
      description: "Créature alchimique tenue en main gauche. Elle frissonne et pointe obstinément vers les coffres cachés. Liée aux énergies des cryptes, elle se dissout si vous tentez de l'extraire du niveau.",
    },
    weapon_gnarled_cemetery_branch: {
      name: 'Branche Noueuse du Cimetière',
      effect: "Fouette l'air avec le bruit sec d'un os qui craque.",
      description: 'Arrachée à un if séculaire qui se nourrit des cadavres de la fosse commune. Légèrement gluante de sève pourpre.',
    },
    weapon_crypt_grave_digger_shovel: {
      name: 'Pelle Affûtée du Fossoyeur Fanatique',
      effect: 'Les impacts sonnent comme une pelletée de terre fraîche jetée sur un cercueil.',
      description: "Le manche est poli par des décennies de besogne nocturne. Le tranchant a décapité plus d'une goule récalcitrante.",
    },
    armor_iron_inquisitor_hauberk: {
      name: "Haubert d'Inquisiteur Ébréché",
      effect: "Les mailles d'acier béni tintent pour dissiper les apparitions spectrales mineures.",
      description: 'Forgé dans un atelier de pénitence. Porte encore les cicatrices noircies des flammes purificatrices.',
    },
    hat_plague_doctor_beak: {
      name: 'Masque à Bec du Médecin Pestilentiel',
      effect: "Filtre les miasmes putrides mais vous fait respirer avec un râle d'agonie terrifiant.",
      description: "Le cuir bouilli est imbibé de vinaigre des quatre voleurs et d'herbes séchées qui n'ont rien guéri du tout.",
    },
    weapon_soul_reaper_athame: {
      name: "Athamé du Moissonneur d'Âmes",
      effect: 'Les victimes laissent échapper un gémissement fantomatique qui emplit vos fioles.',
      description: "Une dague rituelle en argent noir gravée de runes de reliure spirituelle. Elle vibre d'impatience au contact de la chair.",
    },
    boots_specter_phase_treads: {
      name: 'Bottes de Phase Spectrale',
      effect: 'Laisse une traînée de brume ectoplasmique glaciale qui trouble les poursuivants.',
      description: "Tissées avec des linceuls d'âmes en peine. Elles ne touchent jamais tout à fait le sol des cryptes.",
    },
    hat_crown_of_thousand_skulls: {
      name: 'Diadème Cornu du Prince des Morts-Vivants',
      effect: 'Une aura de terreur nécrotique émane de votre front, intimidant les monstres proches.',
      description: "Couronne forgée dans l'or noirci d'anciennes tombes royales, sertie d'un rubis qui palpite comme un cœur gelé.",
    },
    boots_hellfire_conqueror_greaves: {
      name: 'Grèves de Conquérant du Brasier Maudit',
      effect: 'Chaque foulée laisse une flaque de braises spectrales sur les dalles sépulcrales.',
      description: 'D\'épaisses plaques de fer forgé dans les flammes des catacombes les plus profondes. Lourdes mais furieusement stables.',
    },
    armor_aegis_of_the_undying: {
      name: "Cuirasse Titanesque de l'Immorteux",
      effect: 'Une cage thoracique d\'obsidienne absorbe les coups mortels et régénère votre souffle vital.',
      description: 'Forgée avant l\'effondrement de la Première Citadelle par des artisans oubliés. Protège son porteur même par-delà le trépas.',
    },
    hat_halo_of_the_void_sovereign: {
      name: 'Auréole Brisée du Souverain du Néant',
      effect: 'Des éclats cosmiques lévitent au-dessus de votre crâne, amplifiant considérablement vos sorts.',
      description: "Relique cosmique arrachée à une divinité déchue. Sa lueur violacée résonne avec les lois de l'univers lui-même.",
    },
    boots_void_strider_sandals: {
      name: "Sandales Célestes de l'Arpenteur Astral",
      effect: 'Vous marchez sur les courants éthérés, réduisant les frottements physiques à néant.',
      description: 'Tressées avec des filaments d\'étoiles mortes. Marcher avec procure l\'impression troublante de glisser au-dessus des siècles.',
    },
  },
};

export class I18nService {
  public static readonly STORAGE_KEY = 'raycaster_language';
  public static readonly DEFAULT_LANGUAGE: Language = 'en';

  private static currentLanguage: Language = 'en';
  private static isInitialized = false;
  private static readonly listeners = new Set<(lang: Language) => void>();

  public static init(): void {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved === 'en' || saved === 'fr') {
          this.currentLanguage = saved;
        } else {
          this.currentLanguage = this.DEFAULT_LANGUAGE;
        }
      } else {
        this.currentLanguage = this.DEFAULT_LANGUAGE;
      }
    } catch {
      this.currentLanguage = this.DEFAULT_LANGUAGE;
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.currentLanguage;
    }
  }

  public static getCurrentLanguage(): Language {
    this.init();
    return this.currentLanguage;
  }

  public static setLanguage(lang: Language): void {
    this.init();
    if (lang !== 'en' && lang !== 'fr') {
      return;
    }

    if (this.currentLanguage === lang) {
      return;
    }

    this.currentLanguage = lang;

    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY, lang);
      }
    } catch {
      // Ignore localStorage restrictions
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
      this.translateDOM();
    }

    this.notifyListeners();
  }

  public static toggleLanguage(): Language {
    const next: Language = this.getCurrentLanguage() === 'en' ? 'fr' : 'en';
    this.setLanguage(next);
    return next;
  }

  public static subscribe(listener: (lang: Language) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const lang = this.currentLanguage;
    for (const listener of this.listeners) {
      try {
        listener(lang);
      } catch (err) {
        console.error('[I18nService] Erreur dans un abonné:', err);
      }
    }
  }

  /**
   * Retourne la chaîne traduite correspondant à une clé donnée.
   * Si la traduction n'existe pas, renvoie la clé de secours en anglais ou la clé brute.
   */
  public static t(
    key: string,
    params?: Record<string, string | number>,
    targetLang?: Language
  ): string {
    this.init();
    const lang = targetLang ?? this.currentLanguage;
    let template =
      TRANSLATIONS[lang]?.[key] ??
      TRANSLATIONS[this.DEFAULT_LANGUAGE]?.[key] ??
      key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return template;
  }

  /**
   * Parcourt le DOM et met à jour automatiquement les éléments ayant data-i18n.
   */
  public static translateDOM(root?: ParentNode): void {
    if (typeof document === 'undefined') return;
    const container = root ?? document;

    // 1. TextContent standard
    const textEls = container.querySelectorAll<HTMLElement>('[data-i18n]');
    textEls.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = this.t(key);
      }
    });

    // 2. InnerHTML (pour icônes / balisage imbriqué)
    const htmlEls = container.querySelectorAll<HTMLElement>('[data-i18n-html]');
    htmlEls.forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        el.innerHTML = this.t(key);
      }
    });

    // 3. Attribut Title
    const titleEls = container.querySelectorAll<HTMLElement>('[data-i18n-title]');
    titleEls.forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = this.t(key);
      }
    });

    // 4. Attribut Placeholder
    const placeholderEls = container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      '[data-i18n-placeholder]'
    );
    placeholderEls.forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    // 5. Attribut Aria-Label
    const ariaEls = container.querySelectorAll<HTMLElement>('[data-i18n-aria]');
    ariaEls.forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', this.t(key));
      }
    });
  }

  /**
   * Retourne la traduction complète d'un item (nom, effet, description).
   */
  public static getItemTranslation(item: {
    id: string;
    name?: string;
    effect?: string;
    description?: string;
  }): ItemTranslation {
    this.init();
    const lang = this.currentLanguage;
    const custom = ITEM_TRANSLATIONS[lang]?.[item.id];
    if (custom) {
      return custom;
    }

    const enCustom = ITEM_TRANSLATIONS['en']?.[item.id];
    if (enCustom && lang === 'en') {
      return enCustom;
    }

    return {
      name: item.name ?? item.id,
      effect: item.effect ?? '',
      description: item.description ?? '',
    };
  }

  /**
   * Traduit le libellé d'un emplacement d'équipement (hat, weapon, armor, etc.)
   */
  public static getSlotLabel(slot: string): string {
    return this.t(`slot.${slot}`);
  }

  /**
   * Traduit le libellé d'une rareté (common, uncommon, rare, epic, etc.)
   */
  public static getRarityLabel(rarity: string): string {
    return this.t(`rarity.${rarity}`);
  }

  /**
   * Traduit le palier de Gear Score (beginner, novice, initiate, etc.)
   */
  public static getTierLabel(tierKey: GearTierKey): string {
    return this.t(`tier.${tierKey}`);
  }
}
