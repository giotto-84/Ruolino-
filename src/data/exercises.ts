import type { Exercise, Pattern } from '../types';
import { LOWER } from './exercises-lower';
import { UPPER } from './exercises-upper';
import { CORE_AND_MORE } from './exercises-core';

export const EXERCISES: Exercise[] = [...LOWER, ...UPPER, ...CORE_AND_MORE];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const ex = EXERCISE_BY_ID[id];
  if (!ex) throw new Error(`Esercizio sconosciuto: ${id}`);
  return ex;
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'Squat',
  hinge: 'Stacchi e catena posteriore',
  affondo: 'Affondi',
  glutei: 'Glutei',
  estensione_gamba: 'Quadricipiti (isolamento)',
  flessione_gamba: 'Femorali (isolamento)',
  polpacci: 'Polpacci',
  spinta_orizzontale: 'Petto',
  spinta_inclinata: 'Petto alto',
  spinta_verticale: 'Spalle (spinte)',
  tirata_orizzontale: 'Schiena (rematori)',
  tirata_verticale: 'Schiena (tirate dall\'alto)',
  alzate_laterali: 'Spalle (alzate)',
  deltoide_posteriore: 'Spalle posteriori e postura',
  bicipiti: 'Bicipiti',
  tricipiti: 'Tricipiti',
  core: 'Addome',
  core_anti_rotazione: 'Core e stabilità',
  cardio: 'Cardio',
  mobilita: 'Riscaldamento e mobilità',
  stretching: 'Stretching',
};

export function imageUrl(ex: Exercise, frame: 0 | 1 = 0): string | undefined {
  if (!ex.img) return undefined;
  return `${import.meta.env.BASE_URL}exercises/${ex.img}/${frame}.jpg`;
}

export function videoUrl(ex: Exercise): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video + ' esecuzione corretta')}`;
}
