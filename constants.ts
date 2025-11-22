
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 600;
export const GRAVITY = 0.2;
export const WIND_MAX = 0.5;
export const EXPLOSION_RADIUS = 28; 
export const TANK_SIZE = 24; 
export const MAX_POWER = 150; 
export const MAX_HEALTH = 100;

// Realistic Day/Dusk Palette
export const SKY_GRADIENT_START = '#1e3a8a'; // Deep Blue (Zenith)
export const SKY_GRADIENT_END = '#bfdbfe';   // Light Blue/Haze (Horizon)

export const TERRAIN_GRASS_COLOR = '#65a30d';  // Lime 600 (Grass)
export const TERRAIN_DIRT_START = '#574a35'; // Brown (Top dirt)
export const TERRAIN_DIRT_END = '#292014';   // Dark Brown (Deep earth)

export const PLAYER_COLORS = ['#b91c1c', '#1d4ed8']; // Darker Red, Darker Blue (Military matte style)
export const PLAYER_NAMES = ['Red Baron', 'Blue Phantom'];

export const PARTICLE_COUNT = 60;
export const PARTICLE_LIFE = 50;

// AI Config
export const AI_ERROR_MARGINS = {
  EASY: { angle: 12, power: 15 },
  MEDIUM: { angle: 5, power: 8 },
  HARD: { angle: 1, power: 2 }
};