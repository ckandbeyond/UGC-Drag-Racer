import React, { useEffect, useState } from 'react';
import { REDLINE, OPTIMAL_SHIFT_MIN, OPTIMAL_SHIFT_MAX } from '../constants';

interface TachometerProps {
  rpm: number;
}

const Tachometer: React.FC<TachometerProps> = ({ rpm }) => {
  // Normalize RPM to 0-1 range for rotation
  const maxRpm = 9000;
  const normalizedRpm = Math.min(rpm, maxRpm) / maxRpm;
  // Angle: -120deg to +90deg (210 degree span for a wider gauge look)
  const startAngle = -120;
  const endAngle = 90;
  const totalAngle = endAngle - startAngle;
  const angle = startAngle + (normalizedRpm * totalAngle); 

  const [shiftLightColor, setShiftLightColor] = useState('bg-slate-900');

  useEffect(() => {
    if (rpm >= REDLINE - 100) {
      setShiftLightColor('bg-red-600 animate-pulse shadow-[0_0_30px_#dc2626]');
    } else if (rpm >= OPTIMAL_SHIFT_MIN) {
      setShiftLightColor('bg-green-500 shadow-[0_0_20px_#22c55e]');
    } else if (rpm >= OPTIMAL_SHIFT_MIN - 1000) {
      setShiftLightColor('bg-yellow-500');
    } else {
      setShiftLightColor('bg-slate-800');
    }
  }, [rpm]);

  return (
    <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center">
      {/* Gauge Housing */}
      <div className="absolute inset-0 rounded-full border-8 border-slate-800 bg-slate-950 shadow-2xl"></div>
      
      {/* Shift Light Ring (Outer Glow) */}
      <div className={`absolute -inset-2 rounded-full opacity-20 transition-colors duration-100 ${shiftLightColor}`}></div>

      {/* Ticks and Numbers Container */}
      <div className="absolute inset-2 rounded-full">
         <svg viewBox="0 0 100 100" className="w-full h-full p-1">
            {/* Redline Zone Arc */}
            <path d="M 68 85 A 40 40 0 0 0 88 50" fill="none" stroke="#ef4444" strokeWidth="4" transform={`rotate(${startAngle + 120} 50 50)`} />
            
            {/* Tick Marks */}
            {[...Array(10)].map((_, i) => {
                const rot = startAngle + (i * (totalAngle/9));
                // Only show numbers for 0, 5, 9 roughly? Or just ticks. Let's keep ticks simple.
                return (
                    <g key={i} transform={`rotate(${rot} 50 50)`}>
                        <line 
                            x1="50" y1="12" x2="50" y2="20" 
                            stroke={i > 7 ? '#ef4444' : '#94a3b8'} 
                            strokeWidth="2"
                        />
                    </g>
                );
            })}
         </svg>
      </div>

      {/* Center Display (RPM Only) */}
      <div className="absolute top-2/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
          <span className="text-xl font-mono font-bold text-cyan-400">{Math.round(rpm)}</span>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">x1000 RPM</span>
      </div>

      {/* Needle */}
      <div 
        className="absolute w-1.5 h-24 bg-red-500 origin-bottom rounded-full shadow-[0_0_5px_rgba(239,68,68,0.8)] transition-transform duration-75 ease-linear will-change-transform z-20"
        style={{ 
            bottom: '50%',
            left: 'calc(50% - 3px)', 
            transform: `rotate(${angle}deg)` 
        }}
      ></div>
      
      {/* Needle Cap */}
      <div className="absolute w-6 h-6 bg-slate-700 border-2 border-slate-600 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-30"></div>

      {/* External Shift Light Indicator (Top) */}
      <div className={`absolute -top-6 w-16 h-4 rounded-full border-2 border-slate-900 ${shiftLightColor} transition-colors duration-100 z-0`}></div>
    </div>
  );
};

export default Tachometer;
