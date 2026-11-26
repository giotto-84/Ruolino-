import { db, activeProgram } from './db';
import { generateProgram } from '../logic/generator';
import { applyProgression, initialState, swapInProgram, type ProgressResult } from '../logic/progression';
import { getExercise } from '../data/exercises';
import type { ExerciseState, PlannedExercise, Profile, Program, Session } from '../types';

/** Make sure every exercise in the program has a starting state (initial load / target). */
export async function ensureStates(program: Program, profile: Profile): Promise<void> {
  const planned = program.days.flatMap((d) => d.exercises);
  for (const p of planned) {
    const existing = await db.states.get(p.exerciseId);
    if (!existing) await db.states.put(initialState(getExercise(p.exerciseId), profile, p));
  }
}

/** Create a fresh program (first time, after a check-in, or after changing profile). */
export async function createProgram(profile: Profile, variant = 0): Promise<Program> {
  const program = generateProgram(profile, variant);
  await db.transaction('rw', db.programs, db.states, async () => {
    const all = await db.programs.toArray();
    for (const p of all) if (p.active) await db.programs.update(p.id!, { active: false });
    program.id = await db.programs.add(program);
  });
  await ensureStates(program, profile);
  return program;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db.profile.put(profile);
}

export async function getStateFor(p: PlannedExercise, profile: Profile): Promise<ExerciseState> {
  return (await db.states.get(p.exerciseId)) ?? initialState(getExercise(p.exerciseId), profile, p);
}

export interface FinishResult {
  results: { exerciseId: string; result: ProgressResult }[];
}

export async function finishSession(session: Session, profile: Profile): Promise<FinishResult> {
  const results: FinishResult['results'] = [];
  await db.transaction('rw', db.sessions, db.states, db.programs, async () => {
    await db.sessions.add(session);
    let program = await db.programs.get(session.programId);
    for (const entry of session.entries) {
      const prev = (await db.states.get(entry.exerciseId)) ?? initialState(getExercise(entry.exerciseId), profile, entry.target);
      const result = applyProgression(prev, entry, { rpe: session.rpe, pain: session.pain, profile, date: session.date });
      await db.states.put(result.state);
      if (result.swapTo && program) {
        program = swapInProgram(program, entry.exerciseId, result.swapTo);
        const harder = getExercise(result.swapTo);
        if (!(await db.states.get(harder.id))) await db.states.put(initialState(harder, profile, entry.target));
      }
      results.push({ exerciseId: entry.exerciseId, result });
    }
    if (program) {
      const idx = program.days.findIndex((d) => d.id === session.dayId);
      program.nextDay = (idx + 1) % program.days.length;
      await db.programs.put(program);
    }
  });
  return { results };
}

export async function swapExercise(fromId: string, toId: string, profile: Profile): Promise<void> {
  const program = await activeProgram();
  if (!program) return;
  const next = swapInProgram(program, fromId, toId);
  await db.programs.put(next);
  await ensureStates(next, profile);
}
