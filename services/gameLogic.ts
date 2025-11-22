import { GRAVITY, MAX_POWER, CANVAS_WIDTH, CANVAS_HEIGHT, EXPLOSION_RADIUS } from '../constants';
import { Player, Difficulty } from '../types';
import { AI_ERROR_MARGINS } from '../constants';

interface ShotParams {
  angle: number;
  power: number;
}

/**
 * Simulates a shot physics trajectory.
 * Now performs terrain collision checks to avoid shooting into mountains.
 */
const simulateShot = (
  startX: number, 
  startY: number, 
  targetX: number, 
  targetY: number, 
  angle: number, 
  power: number, 
  wind: number,
  terrainHeights: number[]
): number => {
  const rad = (angle * Math.PI) / 180;
  const powerScale = power * 0.25;
  
  const muzzleLen = 30;
  let x = startX + Math.cos(rad) * muzzleLen;
  let y = startY - 20 - Math.sin(rad) * muzzleLen;
  
  let vx = Math.cos(rad) * powerScale;
  let vy = -Math.sin(rad) * powerScale;
  
  let minDistance = Infinity;
  let hitTerrain = false;
  
  // Increased steps for long-range mortar shots
  for (let i = 0; i < 400; i++) {
    x += vx + wind;
    y += vy;
    vy += GRAVITY;
    
    const dist = Math.sqrt(Math.pow(x - targetX, 2) + Math.pow(y - targetY, 2));
    
    // Track closest approach
    if (dist < minDistance) minDistance = dist;
    
    // Check Bounds
    if (x < 0 || x >= CANVAS_WIDTH) break; // Out of bounds
    if (y > CANVAS_HEIGHT + 100) break; // Fell off world

    // Check Terrain Collision
    // We check if projectile Y is greater than the ground height at this X
    // (Remember Canvas Y is 0 at top, increasing downwards. Terrain Height is the Y value of the surface)
    const floorY = terrainHeights[Math.floor(x)];
    
    if (y >= floorY) {
        // HIT GROUND
        hitTerrain = true;
        
        // If we hit ground, was it close enough to the target to count as a hit?
        // (Indirect fire / splash damage)
        if (dist <= EXPLOSION_RADIUS + 10) {
            return dist; // Valid hit
        } else {
            // We hit a mountain far from target. 
            // Penalize this shot heavily so AI avoids it.
            return 10000 + dist; 
        }
    }
  }
  
  // If we never hit terrain (flew off map or sky), return the closest approach distance.
  // This helps the AI "walk" shots in towards the target even if they miss.
  return minDistance;
};

export const calculateAIShot = (
  shooter: Player, 
  target: Player, 
  wind: number, 
  difficulty: Difficulty,
  terrainHeights: number[]
): ShotParams => {
  let bestShot: ShotParams = { angle: 45, power: 50 };
  let minError = Infinity;

  // Default fallback if no terrain data (shouldn't happen)
  const safeTerrain = terrainHeights.length > 0 ? terrainHeights : new Array(CANVAS_WIDTH).fill(CANVAS_HEIGHT);

  // 1. Coarse Search
  // We check a wide grid of angles and powers
  for (let angle = 10; angle <= 170; angle += 10) {
    // Optimization: Skip angles that point directly into the ground or away
    if (angle < 10 || angle > 170) continue;

    for (let power = 20; power <= MAX_POWER; power += 10) {
      const error = simulateShot(shooter.x, shooter.y, target.x, target.y, angle, power, wind, safeTerrain);
      if (error < minError) {
        minError = error;
        bestShot = { angle, power };
      }
    }
  }

  // 2. Fine Search (local optimization)
  const range = 12;
  const step = 2;
  
  const startAngle = Math.max(0, bestShot.angle - range);
  const endAngle = Math.min(180, bestShot.angle + range);
  const startPower = Math.max(0, bestShot.power - range);
  const endPower = Math.min(MAX_POWER, bestShot.power + range);

  for (let angle = startAngle; angle <= endAngle; angle += step) {
    for (let power = startPower; power <= endPower; power += step) {
       const error = simulateShot(shooter.x, shooter.y, target.x, target.y, angle, power, wind, safeTerrain);
       if (error < minError) {
         minError = error;
         bestShot = { angle, power };
       }
    }
  }

  // Apply Difficulty Error
  const margins = AI_ERROR_MARGINS[difficulty];
  const angleError = (Math.random() * 2 - 1) * margins.angle;
  const powerError = (Math.random() * 2 - 1) * margins.power;

  let finalAngle = Math.round(bestShot.angle + angleError);
  let finalPower = Math.round(bestShot.power + powerError);

  return { 
      angle: Math.max(0, Math.min(180, finalAngle)), 
      power: Math.max(0, Math.min(MAX_POWER, finalPower)) 
  };
};
