export enum GameStatus {
  IDLE = 'IDLE',
  FIRING = 'FIRING',
  PROJECTILE_ACTIVE = 'PROJECTILE_ACTIVE',
  EXPLODING = 'EXPLODING',
  GAME_OVER = 'GAME_OVER'
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  power: number;
  health: number;
  isDead: boolean;
  isAI: boolean; 
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface TurnResult {
  hitPlayerId?: number;
  damage?: number;
  missed: boolean;
  distanceFromTarget?: number;
  shooterName: string;
}

export interface MatchResult {
  id: number;
  winner: string;
  attempts: number;
}