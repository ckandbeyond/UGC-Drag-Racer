import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CarStats, GameState, RaceResult, Opponent, CarDesign, GhostReplay, GhostDataPoint } from '../types';
import { 
  TRACK_LENGTH_METERS, DT, GEAR_RATIOS, REDLINE, 
  IDLE_RPM, BASE_HORSEPOWER, BASE_WEIGHT, BASE_GRIP 
} from '../constants';
import Tachometer from './Tachometer';

interface RaceTrackProps {
  stats: CarStats;
  opponent: Opponent;
  design?: CarDesign;
  ghostReplay?: GhostReplay;
  onRaceFinish: (result: RaceResult) => void;
}

// Physics State per Car
interface CarPhysicsState {
  distance: number;
  speed: number;
  rpm: number;
  gear: number;
  finished: boolean;
  startTime: number;
  finishTime: number;
  wheelSpin: boolean;
}

const RaceTrack: React.FC<RaceTrackProps> = ({ stats, opponent, design, ghostReplay, onRaceFinish }) => {
  // Game State Refs
  const playerState = useRef<CarPhysicsState>({
    distance: 0, speed: 0, rpm: IDLE_RPM, gear: 1, finished: false, startTime: 0, finishTime: 0, wheelSpin: false
  });

  const enemyState = useRef<CarPhysicsState>({
    distance: 0, speed: 0, rpm: IDLE_RPM, gear: 1, finished: false, startTime: 0, finishTime: 0, wheelSpin: false
  });

  const gameState = useRef<'COUNTDOWN' | 'RACING' | 'FINISHED'>('COUNTDOWN');
  const requestRef = useRef<number>();
  const perfectShifts = useRef(0);
  const maxSpeed = useRef(0);
  
  // Recording
  const recordingRef = useRef<GhostDataPoint[]>([]);

  // UI State
  const [countdown, setCountdown] = useState(3);
  const [rpmDisplay, setRpmDisplay] = useState(IDLE_RPM);
  const [gearDisplay, setGearDisplay] = useState(1);
  const [playerDistPercent, setPlayerDistPercent] = useState(0);
  const [enemyDistPercent, setEnemyDistPercent] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  // --- Physics Helper Function ---
  const calculatePhysicsStep = (
      car: CarPhysicsState, 
      carStats: CarStats, 
      isAI: boolean
  ) => {
    if (car.finished) return;

    // --- 1. Constants & Stat Mapping ---
    // Engine Torque Multiplier: Maps 1-10 stat to 1.0x - 1.8x
    const torqueMult = 1.0 + ((carStats.acceleration - 1) / 9) * 0.8; 
    
    // Final Drive Ratio: Higher Top Speed stat = Lower numerical ratio (longer gears)
    const finalDrive = 4.5 - ((carStats.topSpeed - 1) / 9) * 2.0;

    // --- 2. Aerodynamics & Environment ---
    const airDensity = 1.225; // kg/m^3
    const frontalArea = 2.2; // m^2
    const Cd = 0.32; // Drag Coefficient
    
    // Downforce Coefficient (Cl): Grip stat improves aero downforce package
    // Range: 0.1 (No aero) to 0.8 (High downforce wing)
    const Cl = 0.1 + ((carStats.grip - 1) / 9) * 0.7; 

    // Calculate Aero Forces
    const aeroDrag = 0.5 * airDensity * Cd * frontalArea * car.speed * car.speed;
    const aeroDownforce = 0.5 * airDensity * Cl * frontalArea * car.speed * car.speed;

    // --- 3. Tire Physics & Friction ---
    // Coefficient of Friction (mu): Maps 1-10 stat to 0.9 (Street Tires) - 1.6 (Drag Slicks)
    let mu = 0.9 + ((carStats.grip - 1) / 9) * 0.7;
    
    // Dynamic Normal Load on Rear Tires (Drive Wheels)
    // Base weight distribution 60% rear for a drag car + Aero Downforce
    const gravity = 9.81;
    const rearWeightLoad = (BASE_WEIGHT * gravity * 0.60) + aeroDownforce;
    
    // Calculate Traction Limit (The max force tires can put down before slipping)
    const maxTraction = rearWeightLoad * mu;

    // --- 4. Engine Torque Calculation ---
    const normRpm = car.rpm / REDLINE;
    // Simple torque curve: Peaky in middle, drops off near redline
    let torqueCurve = 0.5 + 2.0 * normRpm - 2.5 * normRpm * normRpm; 
    if (car.rpm > REDLINE) torqueCurve = 0; 
    
    const engineTorque = BASE_HORSEPOWER * torqueMult * Math.max(0, torqueCurve);
    const currentGearRatio = GEAR_RATIOS[car.gear - 1];
    const wheelRadius = 0.33; // meters
    
    // Force attempted to be applied to the ground
    let driveForce = (engineTorque * currentGearRatio * finalDrive) / wheelRadius;

    // --- 5. Grip Check (Static vs Kinetic Friction) ---
    if (driveForce > maxTraction) {
        car.wheelSpin = true;
        // Kinetic Friction Penalty: Once spinning, grip drops significantly (0.8x)
        // This simulates "blowing the tires off" - you must throttle down (or shift) to recover
        driveForce = maxTraction * 0.8; 
    } else {
        car.wheelSpin = false;
        // If not spinning, we apply full requested force
    }

    // --- 6. Integration (Force = Mass * Accel) ---
    const netForce = driveForce - aeroDrag;
    const accel = netForce / BASE_WEIGHT;
    
    car.speed += accel * DT;
    if (car.speed < 0) car.speed = 0;
    car.distance += car.speed * DT;

    // --- 7. RPM Physics ---
    const wheelCircumference = 2 * Math.PI * wheelRadius;
    const targetRpm = (car.speed / wheelCircumference) * currentGearRatio * finalDrive * 60;
    
    if (car.wheelSpin) {
        // If spinning, RPM flares up rapidly towards redline
        car.rpm += 8000 * DT;
    } else {
        // If hooked up, RPM matches wheel speed, but cannot drop below idle
        // We apply a slight lag for 'inertia'
        car.rpm = car.rpm * 0.8 + Math.max(IDLE_RPM, targetRpm) * 0.2;
    }

    // Rev Limiter
    if (car.rpm > REDLINE) {
        car.rpm = REDLINE - 50; // Hard cut
        car.speed -= 0.05; // Engine braking/loss of momentum on limiter
    }

    // --- 8. AI Logic ---
    if (isAI && !car.finished) {
        const difficultyMod = opponent.difficulty || 1.0;
        // AI shifts based on difficulty. Harder AI shifts closer to optimal.
        const baseShiftPoint = 7000;
        const randomVar = Math.random() * 800;
        const shiftPoint = baseShiftPoint + (randomVar * difficultyMod);

        if (car.rpm > shiftPoint && car.gear < 6) {
             car.gear++;
             // Artificial RPM drop for AI shift
             car.rpm -= 2000; 
        }
    }

    // --- 9. Finish Check ---
    if (car.distance >= TRACK_LENGTH_METERS) {
        car.finished = true;
        car.finishTime = (Date.now() - car.startTime) / 1000;
    }
  };

  const updateGhostState = (car: CarPhysicsState, replay: GhostReplay) => {
      const now = Date.now();
      const elapsed = (now - car.startTime) / 1000;

      // Find interpolation points
      // This is a simple linear search; could be optimized but fine for <2000 points
      const data = replay.data;
      if (elapsed >= replay.totalTime) {
          car.finished = true;
          car.distance = TRACK_LENGTH_METERS;
          car.finishTime = replay.totalTime;
          return;
      }

      // Find frame
      let i = 0;
      while(i < data.length - 1 && data[i+1].t < elapsed) {
          i++;
      }
      
      const p1 = data[i];
      const p2 = data[i+1];

      if (p1 && p2) {
          const range = p2.t - p1.t;
          const progress = (elapsed - p1.t) / range;
          car.distance = p1.d + (p2.d - p1.d) * progress;
      } else if (p1) {
          car.distance = p1.d;
      }
  };

  const updatePhysics = useCallback(() => {
    if (gameState.current === 'COUNTDOWN' || gameState.current === 'FINISHED') return;

    // --- Player Physics ---
    calculatePhysicsStep(playerState.current, stats, false);
    
    // Record Data
    const elapsed = (Date.now() - playerState.current.startTime) / 1000;
    recordingRef.current.push({ t: elapsed, d: playerState.current.distance });

    if (playerState.current.speed > maxSpeed.current) maxSpeed.current = playerState.current.speed;

    // --- Enemy/Ghost Physics ---
    if (ghostReplay) {
        updateGhostState(enemyState.current, ghostReplay);
    } else {
        calculatePhysicsStep(enemyState.current, opponent.stats, true);
    }

    if (playerState.current.finished && enemyState.current.finished) {
        endRace();
    }
  }, [stats, opponent, ghostReplay]);

  // --- Animation Loop ---
  const animate = useCallback(() => {
    updatePhysics();
    
    setRpmDisplay(playerState.current.rpm);
    setGearDisplay(playerState.current.gear);
    setPlayerDistPercent((playerState.current.distance / TRACK_LENGTH_METERS) * 100);
    setEnemyDistPercent((enemyState.current.distance / TRACK_LENGTH_METERS) * 100);
    
    if (gameState.current === 'RACING' || (!playerState.current.finished || !enemyState.current.finished)) {
        requestRef.current = requestAnimationFrame(animate);
    }
  }, [updatePhysics]);

  const endRace = () => {
    gameState.current = 'FINISHED';
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    
    const p = playerState.current;
    const e = enemyState.current;
    
    setTimeout(() => {
        onRaceFinish({
            playerTime: p.finishTime,
            enemyTime: e.finishTime,
            playerWon: p.finishTime < e.finishTime,
            maxSpeed: maxSpeed.current * 3.6, // km/h
            perfectShifts: perfectShifts.current,
            replayData: recordingRef.current
        });
    }, 1000);
  };

  // --- Controls ---
  const shiftUp = () => {
    if (gameState.current !== 'RACING') return;
    const p = playerState.current;
    if (p.gear < 6) {
        if (p.rpm > REDLINE - 200) {
           setFeedback("LATE!");
        } else if (p.rpm > 7000 && p.rpm < 7800) {
           setFeedback("PERFECT!");
           perfectShifts.current++;
           p.speed += 1.5; // Small boost for perfect shift
        } else if (p.rpm < 5000) {
           setFeedback("EARLY");
        } else {
           setFeedback("GOOD");
        }

        setTimeout(() => setFeedback(null), 800);
        p.gear += 1;
        // Mechanical RPM drop on shift
        p.rpm = p.rpm * 0.65; 
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
        setCountdown((prev) => {
            if (prev === 1) {
                clearInterval(timer);
                gameState.current = 'RACING';
                playerState.current.startTime = Date.now();
                enemyState.current.startTime = Date.now();
                requestRef.current = requestAnimationFrame(animate);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        clearInterval(timer);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleTap = () => {
      shiftUp();
  };

  // Render variables
  const dist = playerState.current.distance;
  const roadTextureOffset = (dist * 100) % 200; 
  
  // Resolve enemy design (either from ghost data or null for default AI)
  const enemyDesign = ghostReplay?.design;

  return (
    <div 
      className="relative w-full h-full bg-slate-900 overflow-hidden select-none"
      onClick={handleTap}
    >
      {/* ================= SCENE (Top 65%) ================= */}
      
      {/* Environment Background with Parallax Layers */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-slate-900">
        
        {/* Sky Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-indigo-950 to-slate-900"></div>

        {/* Searchlights (Atmosphere) */}
        <div className="absolute top-0 left-0 w-full h-1/2 opacity-30">
            <div className="absolute bottom-0 left-1/3 w-16 h-[150%] bg-white/10 blur-2xl origin-bottom animate-[pulse_4s_infinite]" style={{ transform: 'rotate(15deg)' }}></div>
            <div className="absolute bottom-0 left-2/3 w-16 h-[150%] bg-cyan-500/10 blur-2xl origin-bottom animate-[pulse_5s_infinite]" style={{ transform: 'rotate(-20deg)' }}></div>
        </div>

        {/* Layer 1: Far City Skyline (Slowest) */}
        <div 
            className="absolute bottom-[35%] left-0 right-0 h-80 opacity-50 bg-repeat-x will-change-transform"
            style={{ 
                // Silhouette of buildings
                backgroundImage: 'linear-gradient(to top, #020617 0%, #020617 20%, transparent 80%), repeating-linear-gradient(90deg, #020617 0px, #020617 40px, transparent 40px, transparent 150px)',
                backgroundSize: '100% 100%, 300px 100%',
                backgroundPositionX: `${-dist * 5}px` // Slow parallax
            }}
        />

        {/* Layer 2: Mid City Skyline (Medium Speed) */}
        <div 
            className="absolute bottom-[35%] left-0 right-0 h-64 opacity-80 bg-repeat-x will-change-transform"
            style={{ 
                // Buildings with some details/lights
                backgroundImage: `
                    linear-gradient(to top, #000 0%, transparent 50%),
                    repeating-linear-gradient(90deg, #1e293b 0px, #1e293b 60px, transparent 60px, transparent 80px),
                    radial-gradient(circle, #fef08a 2px, transparent 3px)
                `,
                backgroundSize: '100% 100%, 200px 100%, 40px 60px', // The radial gradient creates 'windows'
                backgroundPositionX: `${-dist * 20}px` 
            }}
        />

        {/* Layer 3: Crowd & Fence (Fastest, just behind road) */}
        <div 
            className="absolute bottom-[35%] left-0 right-0 h-24 z-0 bg-repeat-x will-change-transform"
            style={{
                // Fence posts and crowd heads
                backgroundImage: `
                    linear-gradient(to top, #0f172a 0%, transparent 100%),
                    repeating-linear-gradient(90deg, #334155 0px, #334155 5px, transparent 5px, transparent 100px), 
                    radial-gradient(circle at 50% 20%, #64748b 4px, transparent 5px)
                `,
                backgroundSize: '100% 100%, 100px 100%, 20px 30px', 
                backgroundPositionX: `${-dist * 100}px` // Matches road speed roughly
            }}
        ></div>
      </div>

      {/* Road - Elevated to 35% from bottom */}
      <div className="absolute bottom-[35%] w-full h-[30%] bg-gray-800 border-t-4 border-cyan-500/50 overflow-hidden z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-none">
         <div 
           className="absolute inset-0 w-[200%]"
           style={{
             backgroundImage: `
               repeating-linear-gradient(90deg, transparent 0px, transparent 198px, rgba(255,255,255,0.1) 198px, rgba(255,255,255,0.1) 200px),
               linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 40%, rgba(0,0,0,0.5))
             `,
             transform: `translateX(-${roadTextureOffset}px)`
           }}
         ></div>

         {/* Finish Line on Road */}
         <div 
            className="absolute top-0 bottom-0 w-8 left-4 sm:left-16 z-10 flex flex-col justify-center items-center"
            style={{ 
                transform: `translateX(${(TRACK_LENGTH_METERS - playerState.current.distance) * 20}px)` 
            }}
         >
            {/* Checkered Pattern */}
            <div className="w-full h-full bg-white opacity-90" 
                 style={{ 
                     backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)',
                     backgroundSize: '16px 16px',
                     backgroundPosition: '0 0, 8px 8px'
                 }} 
            />
         </div>
      </div>

      {/* Cars - Positioned on the elevated road */}
      <div className="absolute bottom-[calc(35%+4%)] left-0 right-0 h-40 z-20 pointer-events-none">
         
         {/* Player Car */}
         {design ? (
            /* Custom Design Rendering */
            <div className="absolute left-4 sm:left-16 bottom-2 w-48 h-24 z-20 flex items-center" 
                style={{ 
                    transform: `translateY(${playerState.current.speed > 5 ? Math.sin(Date.now()/50)*2 : 0}px)`
                }}>
                {/* Drawn Body Chassis */}
                <img src={design.imageData} className="absolute w-full h-auto drop-shadow-xl" alt="Player Car" />
                
                {/* Custom Wheels (Spinning) positioned by user percent */}
                {design.wheelPositions.map((pos, i) => (
                    <div 
                        key={i}
                        className="absolute w-12 h-12"
                        style={{ 
                            // Position relative to the container
                            left: `${pos.x}%`, 
                            top: `${pos.y}%`,
                            // Center the wheel div on the coordinate point
                            transform: 'translate(-50%, -50%)', 
                        }}
                    >
                        {/* Spinning Inner Wheel */}
                        <div 
                            className="w-full h-full rounded-full bg-black border-4 border-gray-400 shadow-lg animate-spin"
                            style={{
                                animationDuration: `${Math.max(0.05, 10/Math.max(1, playerState.current.speed))}s`
                            }}
                        >
                             {/* Rim Spokes */}
                             <div className="absolute inset-0 border-t-2 border-b-2 border-gray-600 rotate-45"></div>
                             <div className="absolute inset-0 border-r-2 border-l-2 border-gray-600"></div>
                        </div>
                    </div>
                ))}

                {/* FX */}
                {playerState.current.wheelSpin && <div className="absolute bottom-0 right-0 w-20 h-12 bg-white/40 blur-lg animate-pulse"></div>}
                {rpmDisplay > 7000 && <div className="absolute -left-4 top-1/2 w-16 h-8 bg-orange-500 rounded-l-full animate-pulse blur-md opacity-90"></div>}
            </div>
         ) : (
             /* Default Car Rendering */
             <div className="absolute left-4 sm:left-16 bottom-2 w-40 h-12 bg-cyan-500 rounded-tr-full rounded-tl-lg skew-x-[-15deg] shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-center z-20">
                 <div className="w-10 h-10 rounded-full bg-black border-4 border-gray-700 absolute -bottom-4 left-5 animate-spin" style={{ animationDuration: `${Math.max(0.05, 10/Math.max(1, playerState.current.speed))}s` }}></div>
                 <div className="w-12 h-12 rounded-full bg-black border-4 border-gray-700 absolute -bottom-4 right-5 animate-spin" style={{ animationDuration: `${Math.max(0.05, 10/Math.max(1, playerState.current.speed))}s` }}></div>
                 
                 <div className="absolute inset-x-2 top-1 h-4 bg-cyan-300/30 skew-x-[20deg] rounded-sm"></div>
                 <span className="text-xs text-black font-black italic transform skew-x-[15deg] z-10">PLAYER</span>
                 
                 {playerState.current.wheelSpin && <div className="absolute -bottom-2 left-4 w-16 h-10 bg-white/30 blur-lg animate-pulse"></div>}
                 {rpmDisplay > 7000 && <div className="absolute -left-12 bottom-4 w-16 h-8 bg-orange-500 rounded-l-full animate-pulse blur-md opacity-90" style={{ transform: 'scaleX(var(--tw-scale-x))', '--tw-scale-x': (rpmDisplay-7000)/800 }}></div>}
             </div>
         )}

         {/* Enemy Car (Default or Custom Ghost Style) */}
         <div 
            className="absolute bottom-16 z-10 transition-transform duration-75"
            style={{ 
                left: `calc(4rem + ${(enemyState.current.distance - playerState.current.distance) * 20}px)`, 
                display: Math.abs(enemyState.current.distance - playerState.current.distance) > 50 ? 'none' : 'block'
            }}
         >
             {enemyDesign ? (
                /* Custom Ghost/Enemy Design */
                <div className="relative w-48 h-24 flex items-center">
                     <img src={enemyDesign.imageData} className="absolute w-full h-auto drop-shadow-xl" alt="Enemy Car" />
                     {enemyDesign.wheelPositions.map((pos, i) => (
                        <div key={i} className="absolute w-12 h-12" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                            <div className="w-full h-full rounded-full bg-black border-4 border-gray-400 shadow-lg animate-spin" style={{ animationDuration: `${Math.max(0.05, 10/Math.max(1, enemyState.current.speed))}s` }}>
                                <div className="absolute inset-0 border-t-2 border-b-2 border-gray-600 rotate-45"></div>
                                <div className="absolute inset-0 border-r-2 border-l-2 border-gray-600"></div>
                            </div>
                        </div>
                     ))}
                     {/* Name Tag */}
                     <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/50 px-2 py-1 rounded text-xs font-bold text-white whitespace-nowrap">
                        {ghostReplay ? "GHOST" : opponent.name}
                     </div>
                </div>
             ) : (
                /* Default Enemy Body */
                <div className="w-40 h-12 rounded-tr-full rounded-tl-lg skew-x-[-15deg] shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-center relative"
                     style={{ backgroundColor: opponent.color }}
                >
                    <div className="w-10 h-10 rounded-full bg-black border-4 border-gray-700 absolute -bottom-4 left-5 animate-spin" style={{ animationDuration: '0.1s' }}></div>
                    <div className="w-12 h-12 rounded-full bg-black border-4 border-gray-700 absolute -bottom-4 right-5 animate-spin" style={{ animationDuration: '0.1s' }}></div>
                    <span className="text-xs text-white font-black italic transform skew-x-[15deg]">
                        {ghostReplay ? "GHOST" : opponent.name.substring(0,8)}
                    </span>
                </div>
             )}
         </div>
      </div>

      {/* Progress Bar (Top) */}
      <div className="absolute top-4 left-4 right-4 h-3 bg-gray-800 rounded-full z-40 overflow-hidden border border-gray-600 shadow-lg pointer-events-none">
          <div className="absolute top-0 bottom-0 w-2 bg-cyan-400 shadow-[0_0_10px_#22d3ee]" style={{ left: `${Math.min(playerDistPercent, 100)}%` }} />
          <div className={`absolute top-0 bottom-0 w-2 shadow-[0_0_10px_#ef4444] ${ghostReplay ? 'bg-blue-400' : 'bg-red-500'}`} style={{ left: `${Math.min(enemyDistPercent, 100)}%` }} />
          <div className="absolute top-0 bottom-0 w-1 bg-white" style={{ left: '100%' }} />
      </div>

      {/* Shift Feedback (Moved High Up) */}
      <div className="absolute top-24 w-full flex justify-center z-50 pointer-events-none">
          {feedback && (
              <div className={`text-5xl md:text-7xl font-black italic animate-bounce drop-shadow-xl stroke-black ${feedback === 'PERFECT!' ? 'text-green-400' : feedback === 'LATE!' ? 'text-red-500' : 'text-yellow-400'}`}>
                  {feedback}
              </div>
          )}
      </div>

      {/* Countdown Overlay */}
      {countdown > 0 && (
          <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center pointer-events-none">
              <span className="text-9xl font-black text-white animate-ping">{countdown}</span>
          </div>
      )}


      {/* ================= DASHBOARD CONSOLE (Bottom 35%) ================= */}
      <div 
        className="absolute bottom-0 w-full h-[35%] z-40 flex items-center justify-center gap-4 md:gap-12 px-4 shadow-[0_-10px_50px_rgba(0,0,0,1)] border-t-4 border-slate-700"
        style={{
            background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)'
        }}
      >
          {/* Carbon Fiber Texture Overlay */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }}></div>

          {/* Left: Gear Indicator */}
          <div className="relative z-10 flex flex-col items-center">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Gear</span>
              <div className="w-20 h-24 md:w-28 md:h-32 bg-slate-900 rounded-xl border-4 border-slate-700 flex items-center justify-center shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                   <span className="text-6xl md:text-8xl font-black text-white font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                       {gearDisplay}
                   </span>
              </div>
          </div>

          {/* Center: Tachometer */}
          <div className="relative z-10 transform scale-90 md:scale-110">
               <Tachometer rpm={rpmDisplay} />
          </div>

          {/* Right: Digital Speedometer */}
          <div className="relative z-10 flex flex-col items-center w-32">
               <span className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Speed</span>
               <div className="flex items-baseline">
                   <span className="text-5xl md:text-7xl font-black font-mono text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]">
                      {(playerState.current.speed * 3.6).toFixed(0)}
                   </span>
                   <span className="text-sm md:text-base text-slate-500 font-bold ml-1">KM/H</span>
               </div>
          </div>

          {/* Tap Prompt (Small, at bottom of dash) */}
          <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
              <span className="text-[10px] text-slate-600 font-bold animate-pulse tracking-[0.3em]">TAP DASHBOARD TO SHIFT</span>
          </div>
      </div>

    </div>
  );
};

export default RaceTrack;