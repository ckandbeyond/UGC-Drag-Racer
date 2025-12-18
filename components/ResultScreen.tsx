import React from 'react';
import { RaceResult, Opponent } from '../types';

interface ResultScreenProps {
  result: RaceResult;
  opponent: Opponent;
  onReset: () => void;
  onGarage: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ result, opponent, onReset, onGarage }) => {
  return (
    <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
      <h1 className={`text-6xl font-black italic uppercase mb-2 ${result.playerWon ? 'text-green-500' : 'text-red-500'}`}>
        {result.playerWon ? 'VICTORY' : 'DEFEAT'}
      </h1>
      
      <p className="text-gray-300 italic mb-8 text-center max-w-sm">
        "{result.playerWon ? "Not bad... for a rookie." : opponent.taunt}" 
        <br/><span className="text-xs text-gray-500">- {opponent.name}</span>
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
        <div className="bg-slate-800 p-4 rounded border border-slate-600 text-center">
          <div className="text-gray-400 text-xs uppercase">Your Time</div>
          <div className="text-2xl text-white font-mono">{result.playerTime.toFixed(3)}s</div>
        </div>
        <div className="bg-slate-800 p-4 rounded border border-slate-600 text-center">
          <div className="text-gray-400 text-xs uppercase">Opponent</div>
          <div className="text-2xl text-white font-mono">{result.enemyTime.toFixed(3)}s</div>
        </div>
        <div className="bg-slate-800 p-4 rounded border border-slate-600 text-center">
          <div className="text-gray-400 text-xs uppercase">Top Speed</div>
          <div className="text-2xl text-cyan-400 font-mono">{result.maxSpeed.toFixed(0)} km/h</div>
        </div>
        <div className="bg-slate-800 p-4 rounded border border-slate-600 text-center">
          <div className="text-gray-400 text-xs uppercase">Perfect Shifts</div>
          <div className="text-2xl text-green-400 font-mono">{result.perfectShifts}</div>
        </div>
      </div>

      <div className="flex gap-4 w-full max-w-md">
        <button 
            onClick={onGarage}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded uppercase tracking-wider transition-colors"
        >
            Tune Car
        </button>
        <button 
            onClick={onReset}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded uppercase tracking-wider shadow-[0_0_15px_#06b6d4] transition-colors"
        >
            Race Again
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
