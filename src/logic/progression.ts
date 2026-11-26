import { getExercise } from '../data/exercises';
import type { Exercise, ExerciseLog, ExerciseState, PlannedExercise, Profile, Program, Session, Zone } from '../types';
import { canDo } from './generator';

const DAY = 24 * 60 * 60 * 1000;

export function programWeek(program: Program, now = new Date()): number {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(new Date(program.createdAt)).getTime()) / DAY);
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function isDeloadWeek(program: Program, now = new Date()): boolean {
  return programWeek(program, now) === program.weeks;
}

/** Adjust the plan for the current week: lighter start for absolute beginners, deload in the last week. */
export function effectiveTarget(p: PlannedExercise, program: Program, profile: Profile, now = new Date()): PlannedExercise {
  const week = programWeek(program, now);
  let sets = p.sets;
  if (week <= 2 && profile.experience === 'nessuna') sets = Math.max(2, sets - 1);
  if (week === program.weeks) sets = Math.max(1, sets - 1);
  return { ...p, sets };
}

function roundTo(value: number, step: number): number {
  return Math.max(0, Math.round(value / step) * step);
}

export function initialState(ex: Exercise, profile: Profile, planned?: PlannedExercise): ExerciseState {
  let weight = 0;
  if (ex.kind === 'carico' && ex.startKg) {
    const ageFactor = profile.age >= 60 ? 0.75 : profile.age >= 50 ? 0.85 : 1;
    const step = Math.abs(ex.increment ?? 1) || 1;
    const raw = ex.startKg[profile.sex];
    // assisted machines: more assistance = easier, so scale the other way
    weight = (ex.increment ?? 1) < 0 ? roundTo(raw / ageFactor, step) : roundTo(raw * ageFactor, step);
  }
  return {
    exerciseId: ex.id,
    weight,
    reps: ex.kind === 'corpo_libero' ? planned?.repMax : undefined,
    seconds: ex.kind === 'tempo' ? planned?.seconds : undefined,
    successStreak: 0,
    history: [],
  };
}

export interface ProgressResult {
  state: ExerciseState;
  message: string;
  tone: 'up' | 'same' | 'down' | 'swap';
  swapTo?: string;
}

export interface ProgressContext {
  rpe: number;
  pain: Zone[];
  profile: Profile;
  date: string;
}

export function applyProgression(prev: ExerciseState, log: ExerciseLog, ctx: ProgressContext): ProgressResult {
  const ex = getExercise(log.exerciseId);
  const done = log.sets.filter((s) => s.done);
  const target = log.target;
  const state: ExerciseState = { ...prev, history: [...prev.history] };

  const painHere = ex.stresses?.some((z) => ctx.pain.includes(z)) ?? false;
  const tooHard = ctx.rpe >= 9;
  const blocked = painHere || tooHard;
  const blockReason = painHere
    ? 'Hai segnalato dolore in una zona coinvolta: per ora non aumentiamo.'
    : 'Seduta molto faticosa: consolidiamo prima di aumentare.';

  if (done.length === 0) {
    return { state, message: 'Non registrato: resta tutto com\'era.', tone: 'same' };
  }

  if (ex.kind === 'tempo') {
    const goal = state.seconds ?? target.seconds ?? 30;
    const best = Math.max(...done.map((s) => s.seconds ?? 0));
    state.history.push({ date: ctx.date, weight: 0, bestReps: 0, seconds: best });
    const allOk = done.length >= target.sets && done.every((s) => (s.seconds ?? 0) >= goal);
    if (allOk && !blocked) {
      const max = ex.pattern === 'cardio' ? 3600 : 90;
      state.seconds = Math.min(max, goal + 5);
      return { state, message: `Ottimo! La prossima volta tieni ${state.seconds} secondi.`, tone: 'up' };
    }
    state.seconds = goal;
    return { state, message: blocked ? blockReason : `Riprova a tenere ${goal} secondi in tutte le serie.`, tone: 'same' };
  }

  const bestReps = Math.max(...done.map((s) => s.reps));

  if (ex.kind === 'corpo_libero') {
    const goal = state.reps ?? target.repMax;
    state.history.push({ date: ctx.date, weight: 0, bestReps });
    const allOk = done.length >= target.sets && done.every((s) => s.reps >= goal);
    if (allOk && !blocked) {
      const harder = ex.harder ? getExercise(ex.harder) : undefined;
      if (harder && canDo(harder, new Set(ctx.profile.equipment))) {
        return {
          state: { ...state, successStreak: 0 },
          message: `Sei pronto per il livello successivo: «${harder.name}».`,
          tone: 'swap',
          swapTo: harder.id,
        };
      }
      state.reps = Math.min(target.repMax + 10, goal + 2);
      return { state, message: `Obiettivo raggiunto! Prossima volta punta a ${state.reps} ripetizioni.`, tone: 'up' };
    }
    state.reps = goal;
    return { state, message: blocked ? blockReason : `Punta a ${goal} ripetizioni in ogni serie.`, tone: 'same' };
  }

  // carico
  const used = Math.max(...done.map((s) => s.weight));
  const inc = ex.increment ?? 2.5;
  const assisted = inc < 0;
  // With assisted machines, the "working" weight is the lowest assistance used.
  const base = assisted ? Math.min(...done.map((s) => s.weight)) : used;
  state.weight = base;
  state.history.push({ date: ctx.date, weight: base, bestReps });

  const allTop = done.length >= target.sets && done.every((s) => s.reps >= target.repMax);
  const failed = done.length < target.sets || done.some((s) => s.reps < target.repMin);

  if (allTop && !blocked) {
    state.weight = Math.max(0, base + inc);
    state.successStreak = 0;
    const verb = assisted ? 'Meno assistenza' : 'Aumenta il carico';
    return { state, message: `${verb}: prossima volta ${fmtKg(state.weight)}.`, tone: 'up' };
  }

  if (failed && !blocked) {
    state.successStreak = Math.min(0, state.successStreak) - 1;
    if (state.successStreak <= -2) {
      const reduced = assisted ? base - inc : base * 0.9;
      state.weight = roundTo(reduced, Math.abs(inc) || 1);
      state.successStreak = 0;
      return { state, message: `Due sedute sotto il minimo: scendiamo a ${fmtKg(state.weight)} per ripartire bene.`, tone: 'down' };
    }
    return { state, message: `Resta su ${fmtKg(base)} e prova a raggiungere ${target.repMin} ripetizioni in ogni serie.`, tone: 'same' };
  }

  state.successStreak = Math.max(0, state.successStreak);
  return {
    state,
    message: blocked ? blockReason : `Resta su ${fmtKg(base)}: quando fai ${target.repMax} ripetizioni in tutte le serie, aumentiamo.`,
    tone: 'same',
  };
}

export function fmtKg(kg: number): string {
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace('.', ',')} kg`;
}

/** Replace an exercise everywhere in the program (used for level-ups and manual swaps). */
export function swapInProgram(program: Program, fromId: string, toId: string): Program {
  return {
    ...program,
    days: program.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: toId } : e)),
    })),
  };
}

// ───────── calendar ─────────

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export interface TodayStatus {
  kind: 'allenamento' | 'fatto' | 'riposo';
  trainedYesterday: boolean;
  nextTraining: Date;
}

export function todayStatus(profile: Profile, sessions: Session[], now = new Date()): TodayStatus {
  const doneToday = sessions.some((s) => sameDay(new Date(s.date), now));
  const yesterday = new Date(now.getTime() - DAY);
  const trainedYesterday = sessions.some((s) => sameDay(new Date(s.date), yesterday));
  const days = profile.trainingDays;
  let next = new Date(now);
  for (let i = doneToday ? 1 : 0; i < 8; i++) {
    const d = new Date(startOfDay(now).getTime() + i * DAY);
    if (days.includes(d.getDay())) {
      next = d;
      break;
    }
  }
  const kind = doneToday ? 'fatto' : days.includes(now.getDay()) ? 'allenamento' : 'riposo';
  return { kind, trainedYesterday, nextTraining: next };
}

/** Monday-based week start. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const shift = (x.getDay() + 6) % 7;
  return new Date(x.getTime() - shift * DAY);
}

export function sessionsThisWeek(sessions: Session[], now = new Date()): Session[] {
  const from = startOfWeek(now).getTime();
  return sessions.filter((s) => new Date(s.date).getTime() >= from);
}

/** Planned sessions between two dates according to the training days. */
export function plannedBetween(trainingDays: number[], from: Date, to: Date): number {
  let n = 0;
  for (let t = startOfDay(from).getTime(); t <= startOfDay(to).getTime(); t += DAY) {
    if (trainingDays.includes(new Date(t).getDay())) n++;
  }
  return n;
}

export function checkinDue(program: Program, checkinWeeks: number[], now = new Date()): number | null {
  const week = programWeek(program, now) - 1; // completed weeks
  const due = Math.floor(week / 4) * 4;
  if (due < 4) return null;
  return checkinWeeks.includes(due) ? null : due;
}
