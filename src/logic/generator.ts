import { EXERCISES, getExercise } from '../data/exercises';
import { hasEquipment } from '../data/equipment';
import type { DayPlan, Exercise, Pattern, PlannedExercise, Profile, Program } from '../types';
import { GOALS } from './goals';

type Role = 'main' | 'acc' | 'core';
interface Slot { pattern: Pattern; role: Role }

const s = (pattern: Pattern, role: Role = 'acc'): Slot => ({ pattern, role });

/** Slots are in priority order: when time is short, the last ones are dropped. */
const TEMPLATES: Record<string, { name: string; focus: string; kind: 'full' | 'upper' | 'lower'; slots: Slot[] }> = {
  FA: {
    name: 'Total body A', focus: 'Squat, spinte e rematori', kind: 'full',
    slots: [s('squat', 'main'), s('spinta_orizzontale', 'main'), s('tirata_orizzontale', 'main'), s('core', 'core'), s('glutei'), s('alzate_laterali'), s('bicipiti')],
  },
  FB: {
    name: 'Total body B', focus: 'Stacchi, spalle e dorsali', kind: 'full',
    slots: [s('hinge', 'main'), s('tirata_verticale', 'main'), s('spinta_verticale', 'main'), s('core_anti_rotazione', 'core'), s('affondo'), s('deltoide_posteriore'), s('tricipiti')],
  },
  FC: {
    name: 'Total body C', focus: 'Affondi, petto alto e schiena', kind: 'full',
    slots: [s('affondo', 'main'), s('spinta_inclinata', 'main'), s('tirata_orizzontale', 'main'), s('core', 'core'), s('flessione_gamba'), s('alzate_laterali'), s('tricipiti')],
  },
  UA: {
    name: 'Parte alta A', focus: 'Petto, dorsali, spalle, braccia', kind: 'upper',
    slots: [s('spinta_orizzontale', 'main'), s('tirata_verticale', 'main'), s('spinta_verticale', 'main'), s('tirata_orizzontale'), s('core', 'core'), s('bicipiti'), s('tricipiti')],
  },
  UB: {
    name: 'Parte alta B', focus: 'Schiena, petto alto, postura', kind: 'upper',
    slots: [s('tirata_orizzontale', 'main'), s('spinta_inclinata', 'main'), s('tirata_verticale', 'main'), s('alzate_laterali'), s('core_anti_rotazione', 'core'), s('deltoide_posteriore'), s('bicipiti'), s('tricipiti')],
  },
  LA: {
    name: 'Gambe A', focus: 'Quadricipiti e glutei', kind: 'lower',
    slots: [s('squat', 'main'), s('hinge', 'main'), s('affondo'), s('core', 'core'), s('flessione_gamba'), s('polpacci')],
  },
  LB: {
    name: 'Gambe B', focus: 'Femorali e glutei', kind: 'lower',
    slots: [s('hinge', 'main'), s('glutei', 'main'), s('squat'), s('core_anti_rotazione', 'core'), s('estensione_gamba'), s('polpacci')],
  },
};

const SPLITS: Record<number, { name: string; days: string[] }> = {
  1: { name: 'Total body', days: ['FA'] },
  2: { name: 'Total body ×2', days: ['FA', 'FB'] },
  3: { name: 'Total body ×3', days: ['FA', 'FB', 'FC'] },
  4: { name: 'Parte alta / gambe', days: ['UA', 'LA', 'UB', 'LB'] },
  5: { name: 'Parte alta / gambe + total body', days: ['UA', 'LA', 'FC', 'UB', 'LB'] },
  6: { name: 'Parte alta / gambe ×3', days: ['UA', 'LA', 'FC', 'UB', 'LB', 'FB'] },
};

/** If a pattern has no doable exercise, try these instead. */
const FALLBACK: Partial<Record<Pattern, Pattern[]>> = {
  spinta_inclinata: ['spinta_orizzontale'],
  tirata_verticale: ['tirata_orizzontale'],
  estensione_gamba: ['affondo', 'squat'],
  flessione_gamba: ['glutei', 'hinge'],
  alzate_laterali: ['spinta_verticale'],
  deltoide_posteriore: ['tirata_orizzontale'],
  spinta_verticale: ['spinta_orizzontale'],
  core_anti_rotazione: ['core'],
  hinge: ['glutei', 'flessione_gamba'],
  squat: ['glutei', 'affondo'],
  affondo: ['glutei', 'squat'],
};

const MACHINES = new Set([
  'leg_press', 'hack_squat', 'smith', 'leg_extension', 'leg_curl_seduto', 'leg_curl_sdraiato', 'abductor',
  'calf_machine', 'hip_thrust_machine', 'hyperextension', 'lat_machine', 'pulley', 'cavi', 'chest_press',
  'pec_deck', 'shoulder_press_machine', 'row_machine', 'assisted_pullup', 'reverse_fly', 'captain_chair',
]);

const usesMachine = (ex: Exercise) => ex.equipment.some((req) => req.split('|').every((r) => MACHINES.has(r)));

export function canDo(ex: Exercise, equipment: Set<string>): boolean {
  return hasEquipment(ex.equipment, equipment);
}

interface PickContext {
  profile: Profile;
  equipment: Set<string>;
  usedInDay: Set<string>;
  usedInProgram: Set<string>;
  variant: number;
  maxLevel: number;
}

function score(ex: Exercise, ctx: PickContext): number {
  let sc = 0;
  if (ex.level === 1) sc += 3;
  else if (ex.level === 2) sc += 1;
  if (ctx.profile.experience === 'nessuna' && !ex.easier) sc += 1;
  if (usesMachine(ex)) sc += 2; // guided movement: safer for beginners
  if (ex.kind === 'carico') sc += 1; // easier to progress
  if (ex.stresses?.some((z) => ctx.profile.injuries.includes(z))) sc -= 6;
  if (ctx.usedInProgram.has(ex.id)) sc -= 3;
  if (ex.accessory) sc -= 3;
  return sc;
}

export function candidatesFor(pattern: Pattern, ctx: PickContext): Exercise[] {
  return EXERCISES.filter(
    (ex) => ex.pattern === pattern && ex.level <= ctx.maxLevel && !ctx.usedInDay.has(ex.id) && canDo(ex, ctx.equipment),
  )
    .map((ex) => ({ ex, sc: score(ex, ctx) }))
    .sort((a, b) => b.sc - a.sc || a.ex.id.localeCompare(b.ex.id))
    .map((x) => x.ex);
}

const stressesInjury = (ex: Exercise, ctx: PickContext) => ex.stresses?.some((z) => ctx.profile.injuries.includes(z)) ?? false;

function pick(pattern: Pattern, ctx: PickContext): Exercise | undefined {
  const patterns = [pattern, ...(FALLBACK[pattern] ?? [])];
  // First pass: only exercises that do not load an injured zone. Second pass: anything doable.
  for (const safeOnly of [true, false]) {
    for (const p of patterns) {
      const list = candidatesFor(p, ctx).filter((e) => !safeOnly || !stressesInjury(e, ctx));
      if (list.length === 0) continue;
      const best = score(list[0], ctx);
      const top = list.filter((e) => score(e, ctx) >= best - 1);
      return top[ctx.variant % top.length];
    }
  }
  return undefined;
}

function plan(ex: Exercise, role: Role, profile: Profile): PlannedExercise {
  const g = GOALS[profile.goal];
  const isMain = role === 'main';
  if (ex.kind === 'tempo') {
    return { exerciseId: ex.id, sets: Math.max(2, g.sets), repMin: 1, repMax: 1, seconds: g.coreSeconds, restSec: 45 };
  }
  return {
    exerciseId: ex.id,
    sets: g.sets,
    repMin: isMain ? g.repMin : g.accRepMin,
    repMax: isMain ? g.repMax : g.accRepMax,
    restSec: isMain ? g.restMain : g.restAcc,
  };
}

/** Rough minutes for one exercise: sets × (work ≈ 40s + rest) + 1 min setup. */
const minutesFor = (p: PlannedExercise) => (p.sets * (40 + p.restSec)) / 60 + 1;

export function bestCardio(equipment: Set<string>): string {
  const order = ['tapis_roulant', 'ellittica', 'cyclette', 'vogatore', 'air_bike', 'stepper', 'corda'];
  for (const id of order) {
    const ex = EXERCISES.find((e) => e.id === id);
    if (ex && canDo(ex, equipment)) return id;
  }
  return 'camminata_veloce';
}

export function generateProgram(profile: Profile, variant = 0): Program {
  const equipment = new Set(profile.equipment);
  const days = Math.min(6, Math.max(1, profile.trainingDays.length || profile.daysPerWeek));
  const split = SPLITS[days];
  const g = GOALS[profile.goal];
  const usedInProgram = new Set<string>();
  const maxLevel = variant >= 2 ? 3 : 2;

  const finisherMin = g.finisher;
  const budget = Math.max(15, profile.minutesPerSession - 12 /* warm-up + cool-down */ - finisherMin);

  const dayPlans: DayPlan[] = split.days.map((key, i) => {
    const tpl = TEMPLATES[key];
    const usedInDay = new Set<string>();
    const exercises: PlannedExercise[] = [];
    let minutes = 0;
    for (const slot of tpl.slots) {
      const ex = pick(slot.pattern, { profile, equipment, usedInDay, usedInProgram, variant: variant + i, maxLevel });
      if (!ex) continue;
      const p = plan(ex, slot.role, profile);
      const cost = minutesFor(p);
      // Always keep at least 3 exercises; afterwards stop when out of time.
      if (exercises.length >= 3 && minutes + cost > budget) continue;
      exercises.push(p);
      minutes += cost;
      usedInDay.add(ex.id);
      usedInProgram.add(ex.id);
    }
    return {
      id: `${key}-${i}`,
      name: tpl.name,
      focus: tpl.focus,
      exercises,
      finisher: finisherMin > 0 ? { exerciseId: bestCardio(equipment), minutes: finisherMin } : undefined,
    };
  });

  return {
    createdAt: new Date().toISOString(),
    goal: profile.goal,
    splitName: split.name,
    days: dayPlans,
    nextDay: 0,
    weeks: 8,
    variant,
    active: true,
  };
}

export function dayKind(day: DayPlan): 'full' | 'upper' | 'lower' {
  const key = day.id.split('-')[0];
  return TEMPLATES[key]?.kind ?? 'full';
}

/** Warm-up: 5 minutes of light cardio, then mobility drills. */
export function warmup(profile: Profile, day: DayPlan): { exerciseId: string; seconds: number }[] {
  const cardio = bestCardio(new Set(profile.equipment));
  const kind = dayKind(day);
  const mobility =
    kind === 'upper'
      ? ['circonduzioni_braccia', 'gatto_cammello', 'worlds_greatest']
      : kind === 'lower'
        ? ['cerchi_anche', 'worlds_greatest', 'squat_mobilita']
        : ['circonduzioni_braccia', 'cerchi_anche', 'worlds_greatest', 'squat_mobilita'];
  const canFloor = profile.equipment.includes('tappetino');
  return [
    { exerciseId: cardio === 'corda' ? 'camminata_veloce' : cardio, seconds: 300 },
    ...mobility
      .filter((id) => canFloor || !getExercise(id).equipment.includes('tappetino'))
      .map((id) => ({ exerciseId: id, seconds: 40 })),
  ];
}

export function cooldown(day: DayPlan): { exerciseId: string; seconds: number }[] {
  const kind = dayKind(day);
  const ids =
    kind === 'upper'
      ? ['stretch_petto', 'stretch_schiena', 'stretch_tricipiti']
      : kind === 'lower'
        ? ['stretch_quadricipiti', 'stretch_femorali', 'stretch_flessori', 'stretch_glutei', 'stretch_polpacci']
        : ['stretch_quadricipiti', 'stretch_femorali', 'stretch_flessori', 'stretch_petto', 'stretch_schiena'];
  return ids.map((id) => ({ exerciseId: id, seconds: 40 }));
}

/** Alternatives the user can swap in for a planned exercise (same pattern, doable with their equipment). */
export function alternatives(exerciseId: string, profile: Profile): Exercise[] {
  const ex = getExercise(exerciseId);
  const equipment = new Set(profile.equipment);
  return EXERCISES.filter((e) => e.pattern === ex.pattern && e.id !== ex.id && canDo(e, equipment));
}
