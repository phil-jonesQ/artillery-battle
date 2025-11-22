import React from 'react';
import { Player, GameStatus } from '../types';
import { MAX_POWER } from '../constants';

interface ControlsProps {
  currentPlayer: Player;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  players: Player[];
  status: GameStatus;
  onFire: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  currentPlayer,
  setPlayers,
  players,
  status,
  onFire
}) => {
  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAngle = parseInt(e.target.value);
    const updated = players.map(p => p.id === currentPlayer.id ? { ...p, angle: newAngle } : p);
    setPlayers(updated);
  };

  const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPower = parseInt(e.target.value);
    const updated = players.map(p => p.id === currentPlayer.id ? { ...p, power: newPower } : p);
    setPlayers(updated);
  };

  // Disable controls if not Idle OR if it's an AI player's turn
  const disabled = status !== GameStatus.IDLE || currentPlayer.isAI;

  return (
    <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-600 gap-4 shadow-lg">
      
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-inner" style={{ backgroundColor: currentPlayer.color }}>
           {currentPlayer.isAI ? 'AI' : currentPlayer.id + 1}
        </div>
        <div>
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            {currentPlayer.name}
            {currentPlayer.isAI && <span className="text-[10px] bg-slate-600 px-1 rounded text-white">AUTO</span>}
          </h2>
          <div className="text-xs text-slate-400">HP: {Math.round(currentPlayer.health)}%</div>
        </div>
      </div>

      <div className="flex flex-1 gap-8 px-4 w-full">
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm text-slate-300">
            <span>Angle</span>
            <span className="font-mono text-cyan-300">{currentPlayer.angle}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="180"
            value={currentPlayer.angle}
            onChange={handleAngleChange}
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm text-slate-300">
            <span>Power</span>
            <span className="font-mono text-red-400">{currentPlayer.power}</span>
          </div>
          <input
            type="range"
            min="0"
            max={MAX_POWER}
            value={currentPlayer.power}
            onChange={handlePowerChange}
            disabled={disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <button
        onClick={onFire}
        disabled={disabled}
        className={`
          px-8 py-3 rounded-full font-bold text-lg tracking-wider transition-all transform
          ${disabled 
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50' 
            : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.6)] active:scale-95'
          }
        `}
      >
        {currentPlayer.isAI ? 'AIMING...' : 'FIRE'}
      </button>
    </div>
  );
};