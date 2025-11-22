import { GoogleGenAI } from "@google/genai";
import { TurnResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

// Circuit breaker: If we hit a quota limit, stop trying for the rest of the session.
let isApiBlocked = false;

const FALLBACK_BATTLE_NAMES = [
    "Sector 7G",
    "Neon Wasteland",
    "Cyber Hills",
    "Grid Vertex Alpha",
    "Flux Canyon",
    "Quantum Ridge",
    "Synthwave Valley",
    "Chromium Peaks",
    "Data Stream Delta",
    "Null Void"
];

const FALLBACK_COMMENTARY_HIT = [
    "Direct hit! That's gotta hurt.",
    "Boom! Target acquired.",
    "Precision strike confirmed.",
    "Systems critical! Good shot.",
    "That will leave a mark.",
    "Armor integrity compromised.",
    "Ouch! Right in the CPU.",
    "Devastating impact registered!"
];

const FALLBACK_COMMENTARY_MISS = [
    "Wide right! Recalculating...",
    "Missed by a mile.",
    "Wind shear threw it off.",
    "Target remains operational.",
    "Close, but no cigar.",
    "Trajectory error detected.",
    "Is your targeting computer offline?",
    "Clean miss. Try aiming next time."
];

const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const generateBattleName = async (): Promise<string> => {
  if (isApiBlocked) return getRandom(FALLBACK_BATTLE_NAMES);

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Generate a cool, short, sci-fi name for a battlefield terrain. Maximum 4 words. Do not use quotes.",
    });
    return response.text.trim();
  } catch (error: any) {
    // Check for quota/resource exhausted error codes (usually 429)
    if (error?.status === 429 || error?.code === 429 || error?.message?.includes('quota')) {
        console.warn("Gemini API Quota Exceeded. Switching to offline mode.");
        isApiBlocked = true;
    } else {
        console.warn("Gemini API unavailable:", error);
    }
    return getRandom(FALLBACK_BATTLE_NAMES);
  }
};

export const generateCommentary = async (turnResult: TurnResult, wind: number): Promise<string> => {
  const fallback = turnResult.missed ? getRandom(FALLBACK_COMMENTARY_MISS) : getRandom(FALLBACK_COMMENTARY_HIT);
  
  if (isApiBlocked) return fallback;

  try {
    const prompt = `
      You are a sarcastic, witty sports commentator for a futuristic artillery tank game.
      
      Situation:
      Shooter: ${turnResult.shooterName}
      Wind: ${wind.toFixed(2)} (Positive is right, Negative is left)
      Result: ${turnResult.missed ? 'MISSED!' : `HIT Player ${turnResult.hitPlayerId} for ${turnResult.damage} damage!`}
      ${turnResult.missed ? `Projectile landed approx ${Math.floor(turnResult.distanceFromTarget || 0)} units away from the enemy.` : ''}
      
      Write a ONE sentence comment about this shot. Be funny but concise.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        maxOutputTokens: 50,
      }
    });
    return response.text.trim();
  } catch (error: any) {
     if (error?.status === 429 || error?.code === 429 || error?.message?.includes('quota')) {
        console.warn("Gemini API Quota Exceeded. Switching to offline mode.");
        isApiBlocked = true;
     }
     return fallback;
  }
};