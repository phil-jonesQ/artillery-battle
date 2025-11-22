import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Controls } from './components/Controls';
import { GameStatus, Player, TurnResult, Difficulty, MatchResult } from './types';
import { CANVAS_WIDTH, PLAYER_NAMES, PLAYER_COLORS, WIND_MAX, MAX_HEALTH } from './constants';
import { generateBattleName, generateCommentary } from './services/geminiService';
import { calculateAIShot } from './services/gameLogic';
import { playTurnChangeSound } from './utils/sound';

const getInitialPlayers = (): Player[] => [
  {
    id: 0,
    name: PLAYER_NAMES[0],
    color: PLAYER_COLORS[0],
    x: 100,
    y: 0, 
    angle: 45,
    power: 60,
    health: MAX_HEALTH,
    isDead: false,
    isAI: false
  },
  {
    id: 1,
    name: PLAYER_NAMES[1],
    color: PLAYER_COLORS[1],
    x: CANVAS_WIDTH - 100,
    y: 0, 
    angle: 135,
    power: 60,
    health: MAX_HEALTH,
    isDead: false,
    isAI: true 
  }
];

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>(getInitialPlayers());
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [wind, setWind] = useState(0);
  const [triggerFire, setTriggerFire] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  // Terrain State for AI
  const [terrainHeights, setTerrainHeights] = useState<number[]>([]);

  const [battleName, setBattleName] = useState("Loading Sector...");
  const [commentary, setCommentary] = useState("Systems Online. Awaiting input.");
  const [isCommentating, setIsCommentating] = useState(false);
  const [isGameResetting, setIsGameResetting] = useState(true);

  // Match History
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [turnCount, setTurnCount] = useState(0);

  const aiTimeoutRef = useRef<number | null>(null);
  const isAiProcessing = useRef<boolean>(false);

  useEffect(() => {
    // Initial Load
    const setup = async () => {
      setIsGameResetting(true);
      const name = await generateBattleName();
      setBattleName(name);
      randomizeWind();
      setIsGameResetting(false);
    };
    setup();
    
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setTriggerFire(false);
    isAiProcessing.current = false;
    if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
        aiTimeoutRef.current = null;
    }
    if (!isGameResetting) {
      playTurnChangeSound();
    }
  }, [currentPlayerIndex, isGameResetting]);

  // AI Turn Logic
  useEffect(() => {
    const currentPlayer = players[currentPlayerIndex];
    
    if (status === GameStatus.IDLE && currentPlayer.isAI && !currentPlayer.isDead && !isAiProcessing.current && !isGameResetting) {
       
       isAiProcessing.current = true;

       aiTimeoutRef.current = window.setTimeout(() => {
          const targetIndex = (currentPlayerIndex + 1) % players.length;
          const target = players[targetIndex];
          
          const solution = calculateAIShot(currentPlayer, target, wind, difficulty, terrainHeights);
          
          setPlayers(prev => prev.map(p => 
            p.id === currentPlayer.id ? { ...p, angle: solution.angle, power: solution.power } : p
          ));
          
          setTimeout(() => {
             setTriggerFire(true);
          }, 1000);

       }, 1500); 
    }
  }, [currentPlayerIndex, status, players, wind, difficulty, terrainHeights, isGameResetting]);

  const randomizeWind = () => {
    setWind((Math.random() * 2 - 1) * WIND_MAX);
  };

  const handleTurnComplete = useCallback(async (result: TurnResult) => {
    const alivePlayers = players.filter(p => !p.isDead);
    setTurnCount(prev => prev + 1);

    setIsCommentating(true);
    const comment = await generateCommentary(result, wind);
    setCommentary(comment);
    setIsCommentating(false);

    if (alivePlayers.length <= 1) {
      setStatus(GameStatus.GAME_OVER);
      const winnerName = alivePlayers[0]?.name || 'Draw';
      setCommentary(`GAME OVER. ${winnerName} wins!`);
      
      // Update History
      const newResult: MatchResult = {
         id: Date.now(),
         winner: winnerName,
         attempts: turnCount + 1
      };
      setMatchHistory(prev => [newResult, ...prev].slice(0, 5));

    } else {
      setCurrentPlayerIndex(prev => (prev + 1) % players.length);
      randomizeWind();
    }
  }, [wind, players, turnCount]); 

  const handleFire = () => {
    setTriggerFire(true);
  };

  const handleRestart = async () => {
    // 1. Enter Loading State (Hides GameCanvas)
    setIsGameResetting(true);
    setCommentary("Re-initializing battlefield protocols...");
    
    // 2. Reset State using fresh objects
    setPlayers(getInitialPlayers());
    setCurrentPlayerIndex(0);
    setStatus(GameStatus.IDLE);
    setTurnCount(0);
    randomizeWind();
    isAiProcessing.current = false;
    setTriggerFire(false);
    
    // 3. Wait for Map Generation (Simulate delay if API is too fast to ensure UI transition)
    const startTime = Date.now();
    const name = await generateBattleName();
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
       await new Promise(r => setTimeout(r, 800 - elapsed));
    }
    
    setBattleName(name);
    setCommentary("New match initialized.");
    
    // 4. Reveal Canvas (New Map Mounts -> Guns Drop In)
    setIsGameResetting(false);
  };

  const toggleDifficulty = () => {
    const levels: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
    const next = levels[(levels.indexOf(difficulty) + 1) % levels.length];
    setDifficulty(next);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-cyan-500 selection:text-black">
      <div className="max-w-6xl mx-auto p-4 md:p-8 flex flex-col gap-6">
        
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-tighter uppercase italic">
              {isGameResetting ? 'DEPLOYING...' : battleName}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Heavy Artillery Simulation v2.5</p>
          </div>
          
          <div className="flex items-center gap-6">
            
            <button 
               onClick={handleRestart}
               disabled={isGameResetting}
               className="text-right group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
               <div className="text-xs text-slate-500 uppercase tracking-widest mb-1 group-hover:text-red-400 transition-colors">System</div>
               <div className="text-lg font-bold font-mono text-slate-300 group-hover:text-white transition-colors">
                  QUIT MATCH
               </div>
            </button>

            <div className="w-px h-10 bg-slate-800 mx-2"></div>

            <div className="text-right cursor-pointer group" onClick={toggleDifficulty}>
               <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">AI Difficulty</div>
               <div className={`text-xl font-bold font-mono ${
                 difficulty === 'EASY' ? 'text-green-400' : 
                 difficulty === 'MEDIUM' ? 'text-yellow-400' : 'text-red-500'
               } group-hover:opacity-80`}>
                 {difficulty}
               </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Wind Condition</div>
              <div className="flex items-center justify-end gap-2">
                <span className={`text-2xl font-bold font-mono ${Math.abs(wind) > 0.3 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.abs(wind * 100).toFixed(0)} km/h
                </span>
                <svg 
                  className={`w-6 h-6 text-slate-400 transition-transform duration-500`}
                  style={{ transform: `rotate(${wind > 0 ? 0 : 180}deg)` }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {isGameResetting ? (
          <div className="relative border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl h-[600px] bg-slate-900 flex items-center justify-center flex-col gap-4">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-cyan-400 font-mono tracking-widest animate-pulse">GENERATING TERRAIN...</div>
          </div>
        ) : (
          <GameCanvas
            key={battleName} 
            players={players}
            setPlayers={setPlayers}
            currentPlayerIndex={currentPlayerIndex}
            setCurrentPlayerIndex={setCurrentPlayerIndex}
            status={status}
            setStatus={setStatus}
            wind={wind}
            onTurnComplete={handleTurnComplete}
            triggerFire={triggerFire}
            setTriggerFire={setTriggerFire}
            onTerrainChange={setTerrainHeights}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2">
             <Controls 
                currentPlayer={players[currentPlayerIndex]}
                players={players}
                setPlayers={setPlayers}
                status={status}
                onFire={handleFire}
             />
          </div>

          {/* Added h-full to stretch this container to match the height of the controls column */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-col relative overflow-hidden h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
            
            {/* Commentary Section */}
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              BattleNet Feed
            </h3>
            <div className="flex-1 flex items-center justify-center mb-4 min-h-[4rem]">
               <p className={`text-sm md:text-base text-slate-300 italic text-center leading-relaxed ${isCommentating ? 'animate-pulse' : ''}`}>
                 "{commentary}"
               </p>
            </div>
            {status === GameStatus.GAME_OVER && (
              <button 
                onClick={handleRestart}
                className="mb-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded border border-slate-600 transition-colors"
              >
                REMATCH
              </button>
            )}

            {/* Match History Table - Added flex-grow and proper container styling */}
            <div className="border-t border-slate-800 pt-3 mt-auto">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Battle Log (Last 5)</h4>
               <div className="rounded bg-slate-950 max-h-[150px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                     <thead className="bg-slate-900 text-slate-400 sticky top-0">
                        <tr>
                           <th className="px-2 py-1 font-medium">Winner</th>
                           <th className="px-2 py-1 font-medium text-right">Att.</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-800">
                        {matchHistory.length === 0 ? (
                           <tr>
                              <td colSpan={2} className="px-2 py-2 text-center text-slate-600 italic">No records found</td>
                           </tr>
                        ) : (
                           matchHistory.map(match => (
                              <tr key={match.id}>
                                 <td className={`px-2 py-1 ${match.winner.includes('Blue') ? 'text-blue-400' : 'text-red-400'}`}>
                                    {match.winner}
                                 </td>
                                 <td className="px-2 py-1 text-slate-400 text-right">{match.attempts}</td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default App;