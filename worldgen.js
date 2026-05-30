// worldgen.js — Pure vanilla JS, no imports required
// Exposes window.WorldGenerator

window.WorldGenerator = class WorldGenerator {
  generate(cx, cy, zoom) {
    // PRNG
    function mulberry32(a) {
      return function() {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    let seed = (Math.abs(Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453) | 0) + 1;
    const rand = mulberry32(seed);

    // Helper: pick a random element from an array using the seeded PRNG
    function pick(arr) {
      return arr[Math.floor(rand() * arr.length)];
    }

    // Helper: integer in range [min, max] inclusive
    function randInt(min, max) {
      return min + Math.floor(rand() * (max - min + 1));
    }

    // --- Name ---
    const starters = ['vel','zar','keth','orn','ax','ith','sol','vex','nur','kal','dra','myx','eth','vor','thal'];
    const enders   = ['ion','ara','eth','yx','os','an','ur','ix','el','on','is','um','ar','ex'];
    const name = pick(starters) + pick(enders);

    // --- Civilization ---
    const civilizations = [
      'The Vex Collective',
      'Ancient Builders',
      'Nomadic Spore-Minds',
      'Crystal Seers',
      'Void Walkers',
      'The Eternal Chorus',
      'Mechanist Caste',
      'Photon Tribes'
    ];
    const civilization = pick(civilizations);

    // --- Biome ---
    const biomes = ['crystal', 'organic', 'mechanical', 'void', 'radiant'];
    const biome = pick(biomes);

    // --- Biome color ---
    const biomeColors = {
      crystal:    '#a8d8f0',
      organic:    '#4caf72',
      mechanical: '#b0bec5',
      void:       '#311b92',
      radiant:    '#ffe57f'
    };
    const colorHex = biomeColors[biome];

    // --- Resources ---
    const allResources = [
      'Void Quartz',
      'Luminal Ore',
      'Chrono Dust',
      'Phase Gel',
      'Null Shard',
      'Echo Crystal',
      'Plasma Moss',
      'Gravity Resin',
      'Spectral Iron',
      'Dark Pollen',
      'Aether Salt',
      'Resonite'
    ];
    // Pick 3 distinct resources
    const resourcePool = allResources.slice();
    const resources = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(rand() * resourcePool.length);
      resources.push(resourcePool.splice(idx, 1)[0]);
    }

    // --- Danger Level ---
    const dangerLevel = randInt(1, 10);

    // --- Population ---
    const populationPatterns = ['~X.X Billion', '~X.X Million', 'Extinct', 'Sparse Colonies', 'Dense Urban World', 'Unknown'];
    let populationRaw = pick(populationPatterns);
    // Replace X.X with a real number like 3.7
    if (populationRaw.includes('X.X')) {
      const whole = randInt(1, 9);
      const decimal = randInt(0, 9);
      populationRaw = populationRaw.replace('X.X', `${whole}.${decimal}`);
    }
    const population = populationRaw;

    // --- History ---
    const histories = [
      'This world was once a thriving center of inter-stellar commerce, its spires visible from orbit. A catastrophic resonance event silenced its cities within a single rotation cycle, leaving only echoes in the crystal lattice.',
      'The earliest records speak of a people who carved their language directly into the bedrock using focused plasma streams. Centuries of resource wars eroded their civilization into scattered, mutually hostile clans who no longer share a common tongue.',
      'Explorers from the outer rim first catalogued this world as uninhabitable, yet lifeforms persisted in the deep thermal vents. Over millennia they ascended to the surface, adapting biology and culture alike to the harsh atmospheric conditions above.',
      'Ancient Builder constructs still patrol the equatorial belt, executing maintenance routines for infrastructure their creators abandoned long ago. The machines hold no allegiance to any living faction and respond to intrusion with measured, escalating force.',
      'Legends describe a golden age when this world served as a nexus point for void-travel, its gates threading paths across dozens of star systems. The gates collapsed in a single night; historians still debate whether the cause was sabotage, accident, or deliberate sacrifice.'
    ];
    const historyIndex = Math.floor(rand() * histories.length);
    const history = histories[historyIndex];

    return {
      name,
      civilization,
      biome,
      resources,
      dangerLevel,
      population,
      history,
      colorHex
    };
  }
};
