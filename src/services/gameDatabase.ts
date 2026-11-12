import { GameMetadata } from '../types/game';

export interface GameCatalogEntry {
  titleId: string;
  title: string;
  normalizedTitle: string;
  publisher: string;
  developer?: string;
  releaseDate?: string;
  genre: string;
  description: string;
  aliases: string[];
}

export const SWITCH_TITLES_INDEX: GameCatalogEntry[] = [
  {
    titleId: '0100000000010000',
    title: 'Super Mario Odyssey',
    normalizedTitle: 'super mario odyssey',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2017-10-27',
    genre: 'Platformer',
    description: 'Join Mario on a massive, globe-trotting 3D adventure.',
    aliases: ['mario odyssey', 'odyssey', 'smo'],
  },
  {
    titleId: '01007ef00011e000',
    title: 'The Legend of Zelda: Breath of the Wild',
    normalizedTitle: 'the legend of zelda breath of the wild',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2017-03-03',
    genre: 'Action-Adventure',
    description: 'Step into a world of discovery, exploration, and adventure in Hyrule.',
    aliases: ['zelda', 'botw', 'breath of the wild'],
  },
  {
    titleId: '01002da013484000',
    title: 'The Legend of Zelda: Skyward Sword HD',
    normalizedTitle: 'the legend of zelda skyward sword hd',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2021-07-16',
    genre: 'Action-Adventure',
    description: 'Discover the origin of Link, Zelda, and the Master Sword.',
    aliases: ['skyward sword', 'skyward sword hd', 'zelda skyward sword'],
  },
  {
    titleId: '0100f2c0115b6000',
    title: 'The Legend of Zelda: Tears of the Kingdom',
    normalizedTitle: 'the legend of zelda tears of the kingdom',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2023-05-12',
    genre: 'Action-Adventure',
    description: 'An epic adventure across the surface and skies of Hyrule.',
    aliases: ['totk', 'tears of the kingdom', 'zelda 2'],
  },
  {
    titleId: '010028600ebda000',
    title: 'Super Mario 3D World + Bowser’s Fury',
    normalizedTitle: 'super mario 3d world bowsers fury',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2021-02-12',
    genre: 'Platformer',
    description: 'Pounce and climb through dozens of colorful courses.',
    aliases: ['3d world', 'bowsers fury', 'mario 3d'],
  },
  {
    titleId: '010015100b5c4000',
    title: 'Super Mario Bros. Wonder',
    normalizedTitle: 'super mario bros wonder',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2023-10-20',
    genre: 'Platformer',
    description: 'Expect the unexpected with Wonder Flowers triggering game-changing moments.',
    aliases: ['mario wonder', 'wonder'],
  },
  {
    titleId: '01000a10041ea000',
    title: 'Super Smash Bros. Ultimate',
    normalizedTitle: 'super smash bros ultimate',
    publisher: 'Nintendo',
    developer: 'Bandai Namco Studios / Sora Ltd.',
    releaseDate: '2018-12-07',
    genre: 'Fighting',
    description: 'Gaming icons clash in the ultimate showdown.',
    aliases: ['smash', 'smash ultimate', 'ssbu'],
  },
  {
    titleId: '0100152000022000',
    title: 'Mario Kart 8 Deluxe',
    normalizedTitle: 'mario kart 8 deluxe',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2017-04-28',
    genre: 'Racing',
    description: 'Hit the road with the definitive version of Mario Kart 8.',
    aliases: ['mario kart', 'mk8', 'kart'],
  },
  {
    titleId: '010093801237c000',
    title: 'Metroid Dread',
    normalizedTitle: 'metroid dread',
    publisher: 'Nintendo',
    developer: 'MercurySteam / Nintendo EPD',
    releaseDate: '2021-10-08',
    genre: 'Metroidvania',
    description: 'Join bounty hunter Samus Aran as she escapes a deadly alien world.',
    aliases: ['dread', 'metroid'],
  },
  {
    titleId: '0100abf008968000',
    title: 'Pokémon Scarlet',
    normalizedTitle: 'pokemon scarlet',
    publisher: 'Nintendo / The Pokémon Company',
    developer: 'Game Freak',
    releaseDate: '2022-11-18',
    genre: 'RPG',
    description: 'Catch, battle, and train Pokémon in the open world of Paldea.',
    aliases: ['scarlet', 'pokemon'],
  },
  {
    titleId: '01008f6008c5e000',
    title: 'Pokémon Violet',
    normalizedTitle: 'pokemon violet',
    publisher: 'Nintendo / The Pokémon Company',
    developer: 'Game Freak',
    releaseDate: '2022-11-18',
    genre: 'RPG',
    description: 'Catch, battle, and train Pokémon in the open world of Paldea.',
    aliases: ['violet'],
  },
  {
    titleId: '01006f8002326000',
    title: 'Animal Crossing: New Horizons',
    normalizedTitle: 'animal crossing new horizons',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2020-03-20',
    genre: 'Simulation',
    description: 'Escape to a deserted island and create your personal paradise.',
    aliases: ['animal crossing', 'acnh'],
  },
  {
    titleId: '01006bb00c6f0000',
    title: 'The Legend of Zelda: Link’s Awakening',
    normalizedTitle: 'the legend of zelda links awakening',
    publisher: 'Nintendo',
    developer: 'Grezzo / Nintendo EPD',
    releaseDate: '2019-09-20',
    genre: 'Action-Adventure',
    description: 'Explore a reimagined Koholint Island in one of the most beloved games in the Legend of Zelda series.',
    aliases: ['links awakening', 'zelda awakening', 'koholint'],
  },
  {
    titleId: '0100633007d48000',
    title: 'Hollow Knight',
    normalizedTitle: 'hollow knight',
    publisher: 'Team Cherry',
    developer: 'Team Cherry',
    releaseDate: '2018-06-12',
    genre: 'Metroidvania / Action',
    description: 'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom.',
    aliases: ['hollow knight', 'silksong'],
  },
  {
    titleId: '01005d100807a000',
    title: 'Luigi’s Mansion 3',
    normalizedTitle: 'luigis mansion 3',
    publisher: 'Nintendo',
    developer: 'Next Level Games',
    releaseDate: '2019-10-31',
    genre: 'Action-Adventure',
    description: 'Slam, blow away, and vacuum up ghosts with the all-new Poltergust G-00.',
    aliases: ['luigis mansion', 'mansion 3'],
  },
  {
    titleId: '01004a4010da4000',
    title: 'Super Mario RPG',
    normalizedTitle: 'super mario rpg',
    publisher: 'Nintendo',
    developer: 'ArtePiazza',
    releaseDate: '2023-11-17',
    genre: 'RPG',
    description: 'Team up with an eccentric group of heroes to save Star Road.',
    aliases: ['mario rpg'],
  },
  {
    titleId: '0100d870045b6000',
    title: 'Kirby and the Forgotten Land',
    normalizedTitle: 'kirby and the forgotten land',
    publisher: 'Nintendo',
    developer: 'HAL Laboratory',
    releaseDate: '2022-03-25',
    genre: 'Platformer',
    description: 'Join Kirby in an unforgettable journey through a mysterious world.',
    aliases: ['kirby', 'forgotten land'],
  },
  {
    titleId: '0100c2500fc20000',
    title: 'Splatoon 3',
    normalizedTitle: 'splatoon 3',
    publisher: 'Nintendo',
    developer: 'Nintendo EPD',
    releaseDate: '2022-09-09',
    genre: 'Shooter / Action',
    description: 'Enter 4-on-4 ink-slinging battles in this colorful action shooter packed with style.',
    aliases: ['splatoon', 'splat 3'],
  },
  {
    titleId: '010074f013262000',
    title: 'Xenoblade Chronicles 3',
    normalizedTitle: 'xenoblade chronicles 3',
    publisher: 'Nintendo',
    developer: 'Monolith Soft',
    releaseDate: '2022-07-29',
    genre: 'RPG',
    description: 'Join Noah and Mio on a heartfelt journey through a war-torn world.',
    aliases: ['xenoblade', 'xeno 3', 'xc3'],
  },
  {
    titleId: '010012101468c000',
    title: 'Metroid Prime Remastered',
    normalizedTitle: 'metroid prime remastered',
    publisher: 'Nintendo',
    developer: 'Retro Studios',
    releaseDate: '2023-02-08',
    genre: 'Action-Adventure / First-Person',
    description: 'Step into the boots of Samus Aran as you navigate the winding paths of Tallon IV.',
    aliases: ['metroid prime', 'prime remastered'],
  },
  {
    titleId: '0100535012974000',
    title: 'Hades',
    normalizedTitle: 'hades',
    publisher: 'Supergiant Games',
    developer: 'Supergiant Games',
    releaseDate: '2020-09-17',
    genre: 'Rogue-like / Action',
    description: 'Defy the god of the dead as you hack and slash out of the Underworld.',
    aliases: ['hades'],
  },
  {
    titleId: '01002b30028f6000',
    title: 'Celeste',
    normalizedTitle: 'celeste',
    publisher: 'Maddy Makes Games',
    developer: 'Maddy Makes Games',
    releaseDate: '2018-01-25',
    genre: 'Platformer',
    description: 'Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.',
    aliases: ['celeste'],
  },
];

export function searchCatalogCandidates(searchTerm: string): GameCatalogEntry[] {
  const clean = normalizeSearchTerm(searchTerm);
  if (!clean) return [];

  const results: { entry: GameCatalogEntry; score: number }[] = [];
  const queryTokens = clean.split(' ');

  for (const item of SWITCH_TITLES_INDEX) {
    const norm = normalizeSearchTerm(item.normalizedTitle);
    const titleIdClean = item.titleId.toLowerCase();
    const normalizedAliases = item.aliases.map(normalizeSearchTerm);
    let score = 0;

    if (titleIdClean === clean) {
      score = 200;
    } else if (norm === clean) {
      score = 100;
    } else if (norm.startsWith(clean)) {
      score = 80;
    } else if (norm.includes(clean)) {
      score = 60;
    } else {
      const exactAlias = normalizedAliases.includes(clean);
      const aliasPrefix = normalizedAliases.some((alias) => alias.startsWith(clean));
      const titleTokens = new Set(norm.split(' '));
      const matchingTokens = queryTokens.filter((token) => titleTokens.has(token)).length;
      const tokenCoverage = matchingTokens / queryTokens.length;

      if (exactAlias) {
        score = 90;
      } else if (aliasPrefix && clean.length >= 4) {
        score = 65;
      } else if (tokenCoverage >= 0.6) {
        score = 40 + tokenCoverage * 30;
      }
    }

    if (score > 0) {
      results.push({ entry: item, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).map((r) => r.entry);
}

function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function findSwitchTitleInCatalog(searchTerm: string): GameCatalogEntry | null {
  const candidates = searchCatalogCandidates(searchTerm);
  return candidates.length > 0 ? candidates[0] : null;
}
