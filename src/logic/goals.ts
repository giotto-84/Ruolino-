import type { Goal } from '../types';

export interface GoalParams {
  label: string;
  description: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Rep range for accessory exercises. */
  accRepMin: number;
  accRepMax: number;
  restMain: number;
  restAcc: number;
  /** Cardio at the end of the session, minutes (0 = none). */
  finisher: number;
  coreSeconds: number;
}

export const GOALS: Record<Goal, GoalParams> = {
  dimagrimento: {
    label: 'Perdere peso',
    description: 'Bruciare grasso mantenendo i muscoli',
    sets: 3, repMin: 10, repMax: 15, accRepMin: 12, accRepMax: 15,
    restMain: 60, restAcc: 45, finisher: 15, coreSeconds: 25,
  },
  massa: {
    label: 'Aumentare la massa muscolare',
    description: 'Muscoli più grandi e definiti',
    sets: 3, repMin: 8, repMax: 12, accRepMin: 10, accRepMax: 15,
    restMain: 90, restAcc: 60, finisher: 0, coreSeconds: 30,
  },
  tonificazione: {
    label: 'Tonificare',
    description: 'Corpo più compatto, forma fisica generale',
    sets: 3, repMin: 10, repMax: 15, accRepMin: 12, accRepMax: 15,
    restMain: 60, restAcc: 45, finisher: 10, coreSeconds: 25,
  },
  forza: {
    label: 'Diventare più forte',
    description: 'Sollevare carichi maggiori',
    sets: 3, repMin: 6, repMax: 8, accRepMin: 8, accRepMax: 12,
    restMain: 120, restAcc: 75, finisher: 0, coreSeconds: 30,
  },
  salute: {
    label: 'Salute e postura',
    description: 'Muoversi meglio, meno dolori, più energia',
    sets: 2, repMin: 10, repMax: 15, accRepMin: 12, accRepMax: 15,
    restMain: 60, restAcc: 45, finisher: 10, coreSeconds: 20,
  },
  resistenza: {
    label: 'Più fiato e resistenza',
    description: 'Stancarsi meno nella vita di tutti i giorni',
    sets: 2, repMin: 15, repMax: 20, accRepMin: 15, accRepMax: 20,
    restMain: 45, restAcc: 30, finisher: 20, coreSeconds: 30,
  },
  sport: {
    label: 'Preparazione per uno sport',
    description: 'Forza e stabilità per correre, giocare, sciare…',
    sets: 3, repMin: 8, repMax: 12, accRepMin: 10, accRepMax: 15,
    restMain: 75, restAcc: 60, finisher: 10, coreSeconds: 30,
  },
};

export const WEEKDAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** Spread training days through the week, leaving rest days in between when possible. */
export function suggestedDays(perWeek: number): number[] {
  const map: Record<number, number[]> = {
    1: [3],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
  };
  return map[Math.min(6, Math.max(1, perWeek))];
}

export const PARQ_QUESTIONS: { id: string; text: string; onlyF?: boolean }[] = [
  { id: 'cuore', text: 'Un medico ti ha mai detto che hai un problema al cuore o la pressione alta?' },
  { id: 'dolore_petto', text: 'Senti dolore al petto a riposo, nella vita di tutti i giorni o quando fai attività fisica?' },
  { id: 'capogiri', text: 'Negli ultimi 12 mesi hai perso l\'equilibrio per capogiri o hai perso conoscenza?' },
  { id: 'cronica', text: 'Ti è stata diagnosticata un\'altra malattia cronica (per esempio diabete, asma, problemi ai reni)?' },
  { id: 'farmaci', text: 'Prendi farmaci prescritti per una malattia cronica?' },
  { id: 'ossa', text: 'Hai (o hai avuto nell\'ultimo anno) un problema a ossa, articolazioni o muscoli che potrebbe peggiorare con l\'attività fisica?' },
  { id: 'supervisione', text: 'Un medico ti ha detto di fare attività fisica solo sotto controllo medico?' },
  { id: 'gravidanza', text: 'Sei in gravidanza o hai partorito negli ultimi 6 mesi?', onlyF: true },
];

export const ZONES: { id: import('../types').Zone; label: string }[] = [
  { id: 'schiena', label: 'Schiena' },
  { id: 'ginocchia', label: 'Ginocchia' },
  { id: 'spalle', label: 'Spalle' },
  { id: 'polsi', label: 'Polsi' },
  { id: 'anche', label: 'Anche' },
  { id: 'collo', label: 'Collo' },
  { id: 'caviglie', label: 'Caviglie' },
];
