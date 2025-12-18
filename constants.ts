export const TRACK_LENGTH_METERS = 402; // 1/4 mile
export const FPS = 60;
export const DT = 1 / FPS;

// Tuning Constraints
export const TOTAL_STAT_POINTS = 18; // Total points to distribute
export const MIN_STAT = 1;
export const MAX_STAT = 10;

// Physics Config
export const GEAR_RATIOS = [3.5, 2.5, 1.8, 1.3, 1.0, 0.8]; // 6 Gears
export const REDLINE = 8000;
export const OPTIMAL_SHIFT_MIN = 7000;
export const OPTIMAL_SHIFT_MAX = 7800;
export const IDLE_RPM = 1000;

// Base Physics
export const BASE_HORSEPOWER = 250;
export const BASE_WEIGHT = 1200; // kg
export const BASE_GRIP = 6000; // Newtons

// Visuals
export const CAR_COLORS = {
  player: '#00f0ff', // Cyan
  enemy: '#ff0055',  // Neon Red
};
