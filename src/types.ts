export type Sex = 'M' | 'F';

export type Goal =
  | 'dimagrimento'
  | 'massa'
  | 'tonificazione'
  | 'forza'
  | 'salute'
  | 'resistenza'
  | 'sport';

export type Location = 'palestra' | 'casa' | 'corpo_libero' | 'personalizzata';

export type Zone = 'schiena' | 'ginocchia' | 'spalle' | 'polsi' | 'anche' | 'collo' | 'caviglie';

export interface Profile {
  id: 'me';
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  waistCm?: number;
  /** PAR-Q answers: true = "sì" (a risk flag). */
  parq: Record<string, boolean>;
  medicalClearance: boolean;
  injuries: Zone[];
  injuryNotes: string;
  job: 'sedentario' | 'misto' | 'attivo';
  sleepHours: number;
  stress: 1 | 2 | 3 | 4 | 5;
  experience: 'nessuna' | 'poca';
  daysPerWeek: number;
  trainingDays: number[]; // 0 = domenica … 6 = sabato
  minutesPerSession: number;
  location: Location;
  equipment: string[];
  goal: Goal;
  targetText: string;
  targetWeightKg?: number;
  targetWeeks: number;
  reminderTime: string; // "18:30"
  createdAt: string;
}

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'affondo'
  | 'glutei'
  | 'estensione_gamba'
  | 'flessione_gamba'
  | 'polpacci'
  | 'spinta_orizzontale'
  | 'spinta_inclinata'
  | 'spinta_verticale'
  | 'tirata_orizzontale'
  | 'tirata_verticale'
  | 'alzate_laterali'
  | 'deltoide_posteriore'
  | 'bicipiti'
  | 'tricipiti'
  | 'core'
  | 'core_anti_rotazione'
  | 'cardio'
  | 'mobilita'
  | 'stretching';

export type ExerciseKind = 'carico' | 'corpo_libero' | 'tempo';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  kind: ExerciseKind;
  /** All of these are required. Each entry may be "a|b" meaning either a or b. */
  equipment: string[];
  level: 1 | 2 | 3;
  /** Small isolation/finishing exercise: never the main lift of a session. */
  accessory?: boolean;
  muscles: string[];
  secondary?: string[];
  setup: string[];
  steps: string[];
  breathing: string;
  errors: string[];
  tip?: string;
  /** Machine-specific adjustment notes. */
  machineSetup?: string[];
  stresses?: Zone[];
  easier?: string;
  harder?: string;
  /** Load increment in kg when progressing (per hand for dumbbells). */
  increment?: number;
  startKg?: { M: number; F: number };
  /** Image folder from free-exercise-db (public domain). */
  img?: string;
  video: string; // YouTube search query
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** for 'tempo' exercises: seconds per set */
  seconds?: number;
  restSec: number;
}

export interface DayPlan {
  id: string;
  name: string;
  focus: string;
  exercises: PlannedExercise[];
  finisher?: { exerciseId: string; minutes: number };
}

export interface Program {
  id?: number;
  createdAt: string;
  goal: Goal;
  splitName: string;
  days: DayPlan[];
  /** Index of the next DayPlan to perform. */
  nextDay: number;
  /** Mesocycle length in weeks; last week is a deload. */
  weeks: number;
  variant: number;
  active: boolean;
}

export interface SetLog {
  weight: number;
  reps: number;
  seconds?: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  target: PlannedExercise;
  sets: SetLog[];
}

export interface Session {
  id?: number;
  date: string; // ISO
  programId: number;
  dayId: string;
  dayName: string;
  entries: ExerciseLog[];
  rpe: number;
  pain: Zone[];
  notes: string;
  durationMin: number;
  deload: boolean;
}

/** Current working parameters for each exercise, updated by progression. */
export interface ExerciseState {
  exerciseId: string;
  weight: number;
  /** For bodyweight: current target reps; for time: seconds. */
  reps?: number;
  seconds?: number;
  successStreak: number;
  history: { date: string; weight: number; bestReps: number; seconds?: number }[];
}

export interface BodyLog {
  id?: number;
  date: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
}

export interface Photo {
  id?: number;
  date: string;
  pose: 'fronte' | 'lato' | 'schiena';
  dataUrl: string;
}

export interface Checkin {
  id?: number;
  programId: number;
  date: string;
  week: number;
  energy: number;
  notes: string;
  summary: string[];
}
