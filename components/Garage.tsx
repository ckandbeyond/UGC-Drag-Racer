import React, { useState, useEffect } from 'react';
import { CarStats, GameState } from '../types';
import { TOTAL_STAT_POINTS, MIN_STAT, MAX_STAT } from '../constants';

interface GarageProps {
  stats: CarStats;
  updateStats: (newStats: CarStats) => void;
  setGameState: (state: GameState) => void;
  hasDesign?: boolean;
}

const SliderControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  description: string;
  disabled: boolean;
}> = ({ label, value, min, max, onChange, description, disabled }) => (
  <div className={`mb-6 p-4 rounded-xl border backdrop-blur-sm transition-opacity ${disabled ? 'opacity-50 border-gray-700 bg-slate-900/50' : 'border-slate-600 bg-slate-800/80'}`}>
    <div className="flex justify-between items-center mb-2">
      <label className="text-white font-bold text-lg uppercase tracking-widest">{label}</label>
      <span className="text-cyan-400 font-mono text-xl">{value}</span>
    </div>
    <div className="relative h-6 flex items-center mb-2">
        <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        disabled={disabled && value === min} // Only disable interaction if we can't move it? No, standard logic below.
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="absolute w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)] [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
        />
    </div>
    <p className="text-xs text-gray-400">{description}</p>
  </div>
);

const Garage: React.FC<GarageProps> = ({ stats, updateStats, setGameState, hasDesign }) => {
  const currentTotal = stats.acceleration + stats.topSpeed + stats.grip;
  const pointsRemaining = TOTAL_STAT_POINTS - currentTotal;

  const handleStatChange = (key: keyof CarStats, newValue: number) => {
    const oldValue = stats[key];
    const diff = newValue - oldValue;

    // Allow decrease always. Allow increase only if we have points.
    if (diff > 0 && pointsRemaining < diff) {
        return; // Not enough points
    }
    
    // Enforce limits
    if (newValue < MIN_STAT || newValue > MAX_STAT) return;

    updateStats({ ...stats, [key]: newValue });
  };

  return (
    <div className="relative z-20 flex flex-col h-full w-full max-w-md mx-auto p-6 animate-fade-in">
      <h2 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2 italic transform -skew-x-12">
        TUNING SHOP
      </h2>
      
      <div className="text-center mb-6">
        <span className="text-gray-400 text-sm uppercase tracking-widest">Points Available:</span>
        <div className={`text-4xl font-mono font-bold ${pointsRemaining === 0 ? 'text-gray-600' : 'text-green-400 animate-pulse'}`}>
            {pointsRemaining}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 scrollbar-hide">
        <button
          onClick={() => setGameState(GameState.DESIGN)}
          className="w-full mb-6 py-3 bg-purple-900/50 border border-purple-500 text-purple-200 hover:bg-purple-800 hover:text-white rounded font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
        >
           <span className="text-xl">🎨</span> {hasDesign ? "Edit Custom Paint" : "Paint Custom Car"}
        </button>

        <SliderControl
          label="Acceleration / Torque"
          value={stats.acceleration}
          min={MIN_STAT}
          max={MAX_STAT}
          onChange={(v) => handleStatChange('acceleration', v)}
          description="Increases engine torque for faster launches."
          disabled={pointsRemaining === 0 && stats.acceleration < MAX_STAT}
        />

        <SliderControl
          label="Top Speed / Gear Ratio"
          value={stats.topSpeed}
          min={MIN_STAT}
          max={MAX_STAT}
          onChange={(v) => handleStatChange('topSpeed', v)}
          description="High: Longer gears for higher max speed. Low: Shorter gears for punchy accel."
          disabled={pointsRemaining === 0 && stats.topSpeed < MAX_STAT}
        />

        <SliderControl
          label="Wheel Grip"
          value={stats.grip}
          min={MIN_STAT}
          max={MAX_STAT}
          onChange={(v) => handleStatChange('grip', v)}
          description="Reduces wheelspin. Essential for high acceleration builds."
          disabled={pointsRemaining === 0 && stats.grip < MAX_STAT}
        />
      </div>

      <button
        onClick={() => setGameState(GameState.RACE_INTRO)}
        disabled={pointsRemaining > 0}
        className={`mt-4 w-full py-4 text-white font-black text-xl uppercase tracking-widest rounded-sm transition-all border-2
            ${pointsRemaining > 0 
                ? 'bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-700 border-cyan-400 hover:scale-105 shadow-[0_0_20px_rgba(8,145,178,0.5)]'
            }`}
      >
        {pointsRemaining > 0 ? 'Spend All Points' : 'Go to Race'}
      </button>
    </div>
  );
};

export default Garage;
