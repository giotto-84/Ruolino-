import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises';
import { ALL_EQUIPMENT_IDS, LOCATION_PRESETS } from '../src/data/equipment';
import { generateProgram, warmup, cooldown } from '../src/logic/generator';
import { applyProgression, initialState, todayStatus, checkinDue, effectiveTarget } from '../src/logic/progression';
import { buildReminderIcs } from '../src/logic/ics';
import type { Profile, Goal, ExerciseLog } from '../src/types';

const base: Profile = {
  id: 'me', name: 'Test', age: 35, sex: 'M', heightCm: 178, weightKg: 82, parq: {}, medicalClearance: false,
  injuries: [], injuryNotes: '', job: 'sedentario', sleepHours: 7, stress: 3, experience: 'nessuna',
  daysPerWeek: 3, trainingDays: [1, 3, 5], minutesPerSession: 60, location: 'palestra',
  equipment: LOCATION_PRESETS.palestra.equipment, goal: 'tonificazione', targetText: '', targetWeeks: 12,
  reminderTime: '18:30', createdAt: '2026-01-01T00:00:00.000Z',
};

describe('libreria esercizi', () => {
  it('ha id unici e riferimenti validi', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      if (e.easier) expect(EXERCISE_BY_ID[e.easier], `${e.id}.easier`).toBeDefined();
      if (e.harder) expect(EXERCISE_BY_ID[e.harder], `${e.id}.harder`).toBeDefined();
      for (const req of e.equipment) for (const r of req.split('|')) expect(ALL_EQUIPMENT_IDS, `${e.id}: ${r}`).toContain(r);
      expect(e.steps.length).toBeGreaterThan(0);
      if (e.kind === 'carico') expect(e.startKg, `${e.id}.startKg`).toBeDefined();
    }
  });
});

describe('generatore', () => {
  const locations = ['palestra', 'casa', 'corpo_libero'] as const;
  const goals: Goal[] = ['dimagrimento', 'massa', 'tonificazione', 'forza', 'salute', 'resistenza', 'sport'];
  for (const loc of locations) {
    for (const days of [2, 3, 4, 5]) {
      it(`${loc}, ${days} giorni: ogni giorno ha almeno 3 esercizi fattibili e senza doppioni`, () => {
        const p: Profile = { ...base, location: loc, equipment: LOCATION_PRESETS[loc].equipment, trainingDays: [1, 2, 3, 4, 5].slice(0, days) };
        for (const goal of goals) {
          const prog = generateProgram({ ...p, goal });
          expect(prog.days).toHaveLength(days);
          for (const d of prog.days) {
            expect(d.exercises.length).toBeGreaterThanOrEqual(3);
            const ids = d.exercises.map((e) => e.exerciseId);
            expect(new Set(ids).size).toBe(ids.length);
            for (const id of ids) {
              const ex = EXERCISE_BY_ID[id];
              for (const req of ex.equipment) expect(req.split('|').some((r) => p.equipment.includes(r))).toBe(true);
            }
            expect(warmup(p, d).length).toBeGreaterThan(1);
            expect(cooldown(d).length).toBeGreaterThan(2);
          }
        }
      });
    }
  }

  it('in palestra un principiante parte dalle macchine guidate', () => {
    const prog = generateProgram(base);
    const first = prog.days[0].exercises[0].exerciseId;
    expect(['leg_press', 'hack_squat', 'smith_squat']).toContain(first);
  });

  it('evita gli esercizi che sollecitano una zona infortunata, se c\'è un\'alternativa', () => {
    const prog = generateProgram({ ...base, injuries: ['schiena'] });
    const all = prog.days.flatMap((d) => d.exercises.map((e) => EXERCISE_BY_ID[e.exerciseId]));
    expect(all.filter((e) => e.stresses?.includes('schiena'))).toHaveLength(0);
  });

  it('con poco tempo propone meno esercizi', () => {
    const short = generateProgram({ ...base, minutesPerSession: 30 });
    const long = generateProgram({ ...base, minutesPerSession: 75 });
    expect(short.days[0].exercises.length).toBeLessThan(long.days[0].exercises.length);
  });

  it('il dimagrimento aggiunge cardio finale, la massa no', () => {
    expect(generateProgram({ ...base, goal: 'dimagrimento' }).days[0].finisher).toBeDefined();
    expect(generateProgram({ ...base, goal: 'massa' }).days[0].finisher).toBeUndefined();
  });
});

describe('progressione', () => {
  const ctx = { rpe: 7, pain: [], profile: base, date: '2026-01-05' };
  const target = { exerciseId: 'leg_press', sets: 3, repMin: 10, repMax: 12, restSec: 60 };
  const log = (reps: number[], weight = 40): ExerciseLog => ({
    exerciseId: 'leg_press', target, sets: reps.map((r) => ({ weight, reps: r, done: true })),
  });
  const st = initialState(EXERCISE_BY_ID.leg_press, base, target);

  it('aumenta il carico quando tutte le serie arrivano al massimo delle ripetizioni', () => {
    const r = applyProgression(st, log([12, 12, 12]), ctx);
    expect(r.tone).toBe('up');
    expect(r.state.weight).toBe(45);
  });
  it('mantiene il carico se non tutte le serie sono complete', () => {
    const r = applyProgression(st, log([12, 11, 10]), ctx);
    expect(r.state.weight).toBe(40);
  });
  it('non aumenta se la seduta è stata troppo dura o c\'è dolore', () => {
    expect(applyProgression(st, log([12, 12, 12]), { ...ctx, rpe: 9 }).state.weight).toBe(40);
    expect(applyProgression(st, log([12, 12, 12]), { ...ctx, pain: ['ginocchia'] }).state.weight).toBe(40);
  });
  it('riduce del 10% dopo due sedute sotto il minimo', () => {
    const r1 = applyProgression(st, log([8, 7, 6]), ctx);
    const r2 = applyProgression(r1.state, log([8, 7, 6]), ctx);
    expect(r2.tone).toBe('down');
    expect(r2.state.weight).toBe(35);
  });
  it('a corpo libero propone la variante più difficile', () => {
    const t = { exerciseId: 'push_up_inclinati', sets: 3, repMin: 10, repMax: 15, restSec: 60 };
    const s0 = initialState(EXERCISE_BY_ID.push_up_inclinati, base, t);
    const r = applyProgression(s0, { exerciseId: 'push_up_inclinati', target: t, sets: [15, 15, 15].map((reps) => ({ weight: 0, reps, done: true })) }, ctx);
    expect(r.tone).toBe('swap');
    expect(r.swapTo).toBe('push_up');
  });
  it('macchina assistita: progredire significa togliere peso', () => {
    const t = { exerciseId: 'trazioni_assistite', sets: 3, repMin: 8, repMax: 10, restSec: 90 };
    const r = applyProgression(
      { exerciseId: 'trazioni_assistite', weight: 40, successStreak: 0, history: [] },
      { exerciseId: 'trazioni_assistite', target: t, sets: [10, 10, 10].map((reps) => ({ weight: 40, reps, done: true })) },
      ctx,
    );
    expect(r.state.weight).toBe(35);
  });
});

describe('calendario', () => {
  it('riconosce giorni di allenamento e riposo', () => {
    const monday = new Date(2026, 10, 23, 10);
    const tuesday = new Date(2026, 10, 24, 10);
    expect(todayStatus(base, [], monday).kind).toBe('allenamento');
    expect(todayStatus(base, [], tuesday).kind).toBe('riposo');
    expect(todayStatus(base, [], tuesday).nextTraining.getDay()).toBe(3);
  });
  it('propone il check-in ogni 4 settimane', () => {
    const prog = generateProgram({ ...base });
    prog.createdAt = new Date(2026, 0, 1).toISOString();
    expect(checkinDue(prog, [], new Date(2026, 0, 20))).toBeNull();
    expect(checkinDue(prog, [], new Date(2026, 0, 30))).toBe(4);
    expect(checkinDue(prog, [4], new Date(2026, 0, 30))).toBeNull();
  });
  it('scarico nell\'ultima settimana e adattamento nelle prime due', () => {
    const prog = generateProgram({ ...base });
    prog.createdAt = new Date(2026, 0, 1).toISOString();
    const p = prog.days[0].exercises[0];
    expect(effectiveTarget(p, prog, base, new Date(2026, 0, 3)).sets).toBe(p.sets - 1);
    expect(effectiveTarget(p, prog, base, new Date(2026, 0, 20)).sets).toBe(p.sets);
    expect(effectiveTarget(p, prog, base, new Date(2026, 1, 22)).sets).toBe(p.sets - 1);
  });
  it('genera un promemoria .ics settimanale', () => {
    const ics = buildReminderIcs([1, 3, 5], '18:30', new Date(2026, 10, 24, 9));
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(ics).toContain('DTSTART:20261125T183000');
  });
});
