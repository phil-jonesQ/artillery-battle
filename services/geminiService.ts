import { TurnResult } from '../types';

// Standalone Dictionary for Battle Names
const BATTLE_NAMES = [
    "Sector 7G",
    "Neon Wasteland",
    "Cyber Hills",
    "Grid Vertex Alpha",
    "Flux Canyon",
    "Quantum Ridge",
    "Synthwave Valley",
    "Chromium Peaks",
    "Data Stream Delta",
    "Null Void",
    "Iron Oxide Basin",
    "Titan's Graveyard",
    "Velocity Fields",
    "Echo Summit",
    "Rust Bucket Valley",
    "Cobalt Cliffs",
    "Silicon Dune",
    "Vector Plateau",
    "Midnight Range",
    "Omega Outpost"
];

// Standalone Dictionary for Hit Commentary
const COMMENTARY_HIT = [
    "Direct hit! That's gotta hurt.",
    "Boom! Target acquired.",
    "Precision strike confirmed.",
    "Systems critical! Good shot.",
    "That will leave a mark.",
    "Armor integrity compromised.",
    "Ouch! Right in the CPU.",
    "Devastating impact registered!",
    "Bullseye! Textbooks will write about that one.",
    "Target locked and rocked.",
    "Clean connection. Enemy is reeling.",
    "Maximum damage! The crowd goes wild.",
    "Smoke em' if you got em'. Nice hit.",
    "Kaboom! Physics works.",
    "Structural damage imminent."
];

// Standalone Dictionary for Miss Commentary
const COMMENTARY_MISS = [
    "Wide right! Recalculating...",
    "Missed by a mile.",
    "Wind shear threw it off.",
    "Target remains operational.",
    "Close, but no cigar.",
    "Trajectory error detected.",
    "Is your targeting computer offline?",
    "Clean miss. Try aiming next time.",
    "Just shifting some dirt around.",
    "Swing and a miss!",
    "A warning shot, perhaps?",
    "Terraforming complete. Now hit the tank.",
    "Calculations were slightly off.",
    "Whiff! The air pressure changed though.",
    "No effect on target."
];

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generates a random battle name from the local dictionary.
 */
export const generateBattleName = async (): Promise<string> => {
  // Simulate a tiny network delay for realism in the UI loading state
  await new Promise(resolve => setTimeout(resolve, 500));
  return getRandom(BATTLE_NAMES);
};

/**
 * Generates commentary based on turn result using local dictionaries.
 */
export const generateCommentary = async (turnResult: TurnResult, wind: number): Promise<string> => {
  // Simulate a tiny delay
  await new Promise(resolve => setTimeout(resolve, 300));

  if (turnResult.missed) {
      return getRandom(COMMENTARY_MISS);
  } else {
      // Dynamic string interpolation for hits
      const baseComment = getRandom(COMMENTARY_HIT);
      // Occasional specific damage callout
      if (Math.random() > 0.7) {
          return `Hit for ${turnResult.damage} damage! ${baseComment}`;
      }
      return baseComment;
  }
};