export enum GameState {
  MENU = 'MENU',
  GARAGE = 'GARAGE',
  DESIGN = 'DESIGN',
  RACE_INTRO = 'RACE_INTRO',
  RACING = 'RACING',
  RESULT = 'RESULT',
}

export interface CarStats {
  acceleration: number; // Affects Engine Torque
  topSpeed: number;     // Affects Gear Ratio (Final Drive)
  grip: number;         // Affects Traction Limit
}

export interface CarDesign {
  imageData: string; // Base64 image of the chassis
  wheelPositions: { x: number; y: number }[]; // Array of exactly 2 coordinates (percent relative to width/height)
}

export interface GhostDataPoint {
  t: number; // Time
  d: number; // Distance
}

export interface GhostReplay {
  id: string;
  playerName: string;
  totalTime: number;
  data: GhostDataPoint[];
  date: number;
  design?: CarDesign;
}

export interface Opponent {
  name: string;
  carName: string;
  taunt: string;
  difficulty: number; // 0.8 to 1.2 (reaction time/shift quality modifier)
  color: string;
  stats: CarStats; // AI uses same physics model
  isGhost?: boolean; // Flag to indicate this opponent is a replay
}

export interface RaceResult {
  playerTime: number;
  enemyTime: number;
  playerWon: boolean;
  maxSpeed: number;
  perfectShifts: number;
  replayData: GhostDataPoint[]; // Return the recording
}