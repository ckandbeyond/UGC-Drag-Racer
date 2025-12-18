import React, { useState, useEffect } from 'react';
import { GameState, CarStats, RaceResult, Opponent, CarDesign, GhostReplay } from './types';
import { TOTAL_STAT_POINTS, MIN_STAT, MAX_STAT } from './constants';
import Garage from './components/Garage';
import CarDesigner from './components/CarDesigner';
import RaceTrack from './components/RaceTrack';
import ResultScreen from './components/ResultScreen';
import { generateOpponent } from './services/geminiService';

// Default mock opponent if API fails or not used immediately
const DEFAULT_OPPONENT: Opponent = {
  name: "Viper",
  carName: "Cobra GT",
  taunt: "Eat my dust!",
  difficulty: 0.5,
  color: "#ff0000",
  stats: { acceleration: 6, topSpeed: 6, grip: 6 }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [carStats, setCarStats] = useState<CarStats>({
    acceleration: 6,
    topSpeed: 6,
    grip: 6,
  });
  const [carDesign, setCarDesign] = useState<CarDesign | undefined>(undefined);
  const [opponent, setOpponent] = useState<Opponent>(DEFAULT_OPPONENT);
  const [lastResult, setLastResult] = useState<RaceResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bestGhost, setBestGhost] = useState<GhostReplay | null>(null);
  const [activeGhost, setActiveGhost] = useState<GhostReplay | undefined>(undefined);

  // Load Best Ghost on Start
  useEffect(() => {
    const saved = localStorage.getItem('ndr_best_ghost');
    if (saved) {
      try {
        setBestGhost(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load ghost", e);
      }
    }
  }, []);

  // Distribute points randomly for opponent
  const generateOpponentStats = (): CarStats => {
      let remaining = TOTAL_STAT_POINTS;
      // Start with minimums
      const stats = { acceleration: MIN_STAT, topSpeed: MIN_STAT, grip: MIN_STAT };
      remaining -= (MIN_STAT * 3);

      // Randomly distribute remaining
      const keys: (keyof CarStats)[] = ['acceleration', 'topSpeed', 'grip'];
      while (remaining > 0) {
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          if (stats[randomKey] < MAX_STAT) {
              stats[randomKey]++;
              remaining--;
          }
      }
      return stats;
  };

  const handleStartRaceSetup = async (useGhost: boolean = false) => {
    if (useGhost && bestGhost) {
        // Setup for Ghost Race
        setActiveGhost(bestGhost);
        setOpponent({
            name: "GHOST",
            carName: "Previous Best",
            taunt: "Can you beat yourself?",
            difficulty: 1,
            color: '#60a5fa',
            stats: { acceleration: 0, topSpeed: 0, grip: 0 }, // Not used for ghost
            isGhost: true
        });
        setGameState(GameState.RACING);
        return;
    }

    // Standard AI Race
    setActiveGhost(undefined);
    setIsLoading(true);
    // Use the Gemini API to fetch a dynamic opponent name/taunt
    const avgLevel = 5;
    const genOpponent = await generateOpponent(avgLevel);
    setIsLoading(false);

    // Generate balanced stats
    const enemyStats = generateOpponentStats();

    if (genOpponent) {
        setOpponent({
            ...genOpponent,
            difficulty: 1.0,
            color: '#ff0055',
            stats: enemyStats
        });
    } else {
         setOpponent({
             ...DEFAULT_OPPONENT,
             name: `Racer X`,
             stats: enemyStats
         });
    }
    
    setGameState(GameState.RACING);
  };

  const handleRaceFinish = (result: RaceResult) => {
    setLastResult(result);
    setGameState(GameState.RESULT);

    // Check for new record
    // Only save if it wasn't a ghost race (or if we beat the ghost? let's simple save faster times always)
    // Actually, save if it's faster than current best, regardless of mode.
    if (!bestGhost || result.playerTime < bestGhost.totalTime) {
        const newGhost: GhostReplay = {
            id: Date.now().toString(),
            playerName: "You",
            totalTime: result.playerTime,
            data: result.replayData,
            date: Date.now(),
            design: carDesign
        };
        setBestGhost(newGhost);
        localStorage.setItem('ndr_best_ghost', JSON.stringify(newGhost));
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 text-white overflow-hidden relative font-[Orbitron]">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black pointer-events-none" />

      {gameState === GameState.MENU && (
        <div className="relative z-10 flex flex-col items-center justify-center h-full p-4 text-center">
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-6 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            NEON<br/>DRAG RACER
          </h1>
          <p className="text-gray-400 mb-8 max-w-md text-sm md:text-base">
            Tune your machine. Time your shifts. Dominate the strip.
          </p>
          <div className="flex flex-col gap-4">
              <button
                onClick={() => setGameState(GameState.GARAGE)}
                className="px-12 py-4 bg-cyan-600 text-white font-bold text-xl rounded-sm shadow-[0_0_20px_#0891b2] hover:bg-cyan-500 hover:scale-105 transition-all uppercase tracking-widest clip-path-slant"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
              >
                Enter Garage
              </button>
              {bestGhost && (
                   <div className="text-xs text-gray-500 font-mono mt-2">
                       Best Time: <span className="text-green-400">{bestGhost.totalTime.toFixed(3)}s</span>
                   </div>
              )}
          </div>
        </div>
      )}

      {gameState === GameState.GARAGE && (
        <Garage 
          stats={carStats} 
          updateStats={setCarStats} 
          setGameState={setGameState} 
          hasDesign={!!carDesign}
        />
      )}

      {gameState === GameState.DESIGN && (
        <CarDesigner 
            initialDesign={carDesign}
            onSave={(design) => {
                setCarDesign(design);
                setGameState(GameState.GARAGE);
            }}
            onCancel={() => setGameState(GameState.GARAGE)}
        />
      )}

      {gameState === GameState.RACE_INTRO && (
         <div className="relative z-10 flex flex-col items-center justify-center h-full p-4">
            <h2 className="text-3xl font-bold text-white mb-8 italic">SELECT OPPONENT</h2>
            
            {isLoading ? (
                <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <div className="flex flex-col gap-6 animate-fade-in w-full max-w-sm">
                    {/* Option 1: AI */}
                    <button 
                        onClick={() => handleStartRaceSetup(false)} 
                        className="group relative px-8 py-6 bg-slate-800 border border-slate-600 hover:border-red-500 hover:bg-slate-700 rounded-lg transition-all flex flex-col items-center gap-2"
                    >
                        <span className="text-xl font-black text-red-500 group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">RACE AI RIVAL</span>
                        <span className="text-xs text-gray-400">Standard Difficulty</span>
                    </button>
                    
                    {/* Option 2: Ghost */}
                    {bestGhost ? (
                        <button 
                            onClick={() => handleStartRaceSetup(true)} 
                            className="group relative px-8 py-6 bg-slate-800 border border-slate-600 hover:border-cyan-400 hover:bg-slate-700 rounded-lg transition-all flex flex-col items-center gap-2"
                        >
                            <span className="text-xl font-black text-cyan-400 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">CHALLENGE GHOST</span>
                            <span className="text-xs text-gray-400">Beat your best: {bestGhost.totalTime.toFixed(3)}s</span>
                        </button>
                    ) : (
                         <div className="px-8 py-6 border border-dashed border-gray-700 rounded-lg flex flex-col items-center gap-2 opacity-50">
                             <span className="text-xl font-black text-gray-500">NO GHOST DATA</span>
                             <span className="text-xs text-gray-600">Complete a race to unlock</span>
                         </div>
                    )}
                </div>
            )}
         </div>
      )}

      {gameState === GameState.RACING && (
        <RaceTrack 
          stats={carStats} 
          opponent={opponent} 
          design={carDesign}
          ghostReplay={activeGhost}
          onRaceFinish={handleRaceFinish} 
        />
      )}

      {gameState === GameState.RESULT && lastResult && (
        <ResultScreen 
          result={lastResult} 
          opponent={opponent}
          onReset={() => setGameState(GameState.RACING)}
          onGarage={() => setGameState(GameState.GARAGE)}
        />
      )}
    </div>
  );
};

export default App;