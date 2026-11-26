import type { Location } from '../types';

export interface EquipmentItem {
  id: string;
  name: string;
  hint?: string;
}

export interface EquipmentGroup {
  id: string;
  name: string;
  items: EquipmentItem[];
}

export const EQUIPMENT: EquipmentGroup[] = [
  {
    id: 'base',
    name: 'Casa e corpo libero',
    items: [
      { id: 'tappetino', name: 'Tappetino' },
      { id: 'sedia', name: 'Sedia stabile o divano', hint: 'Per dip e step-up facilitati' },
      { id: 'step', name: 'Step o gradino rialzato' },
      { id: 'sbarra', name: 'Sbarra per trazioni' },
      { id: 'parallele', name: 'Parallele per dip' },
      { id: 'corda', name: 'Corda per saltare' },
    ],
  },
  {
    id: 'pesi',
    name: 'Pesi liberi',
    items: [
      { id: 'manubri', name: 'Manubri' },
      { id: 'bilanciere', name: 'Bilanciere con dischi', hint: 'Il bilanciere olimpico pesa di solito 20 kg' },
      { id: 'ez', name: 'Bilanciere EZ (sagomato)' },
      { id: 'kettlebell', name: 'Kettlebell' },
      { id: 'trapbar', name: 'Trap bar (bilanciere esagonale)' },
      { id: 'rack', name: 'Rack / gabbia per squat' },
      { id: 'panca', name: 'Panca piana' },
      { id: 'panca_inclinata', name: 'Panca inclinabile' },
      { id: 'palla_medica', name: 'Palla medica' },
    ],
  },
  {
    id: 'accessori',
    name: 'Accessori',
    items: [
      { id: 'elastici', name: 'Elastici (fasce o tubolari con maniglie)' },
      { id: 'miniband', name: 'Mini band (elastico ad anello corto)' },
      { id: 'trx', name: 'TRX / cinghie in sospensione' },
      { id: 'fitball', name: 'Fitball' },
      { id: 'ab_wheel', name: 'Ruota per addominali' },
      { id: 'foam_roller', name: 'Foam roller' },
    ],
  },
  {
    id: 'macchine_gambe',
    name: 'Macchine per le gambe',
    items: [
      { id: 'leg_press', name: 'Leg press (pressa)' },
      { id: 'hack_squat', name: 'Hack squat' },
      { id: 'smith', name: 'Smith machine (bilanciere guidato)' },
      { id: 'leg_extension', name: 'Leg extension' },
      { id: 'leg_curl_seduto', name: 'Leg curl da seduto' },
      { id: 'leg_curl_sdraiato', name: 'Leg curl da sdraiato' },
      { id: 'adductor', name: 'Adductor machine (interno coscia)' },
      { id: 'abductor', name: 'Abductor machine (esterno coscia)' },
      { id: 'calf_machine', name: 'Calf machine (polpacci)' },
      { id: 'hip_thrust_machine', name: 'Hip thrust machine / glute machine' },
      { id: 'hyperextension', name: 'Panca per iperestensioni (lombari)' },
    ],
  },
  {
    id: 'macchine_busto',
    name: 'Macchine per busto e braccia',
    items: [
      { id: 'lat_machine', name: 'Lat machine (lat pulldown)' },
      { id: 'pulley', name: 'Pulley basso (rematore ai cavi)' },
      { id: 'cavi', name: 'Stazione cavi / crossover' },
      { id: 'chest_press', name: 'Chest press' },
      { id: 'pec_deck', name: 'Pec deck / butterfly' },
      { id: 'shoulder_press_machine', name: 'Shoulder press machine' },
      { id: 'row_machine', name: 'Row machine (rematore guidato)' },
      { id: 'assisted_pullup', name: 'Macchina trazioni assistite' },
      { id: 'reverse_fly', name: 'Reverse fly machine' },
      { id: 'captain_chair', name: 'Captain\'s chair (sedia romana per addome)' },
    ],
  },
  {
    id: 'cardio',
    name: 'Cardio',
    items: [
      { id: 'tapis_roulant', name: 'Tapis roulant' },
      { id: 'cyclette', name: 'Cyclette' },
      { id: 'ellittica', name: 'Ellittica' },
      { id: 'vogatore', name: 'Vogatore' },
      { id: 'stepper', name: 'Stepper / scale mobili' },
      { id: 'air_bike', name: 'Air bike' },
    ],
  },
];

export const ALL_EQUIPMENT_IDS = EQUIPMENT.flatMap((g) => g.items.map((i) => i.id));

export const EQUIPMENT_NAME: Record<string, string> = Object.fromEntries(
  EQUIPMENT.flatMap((g) => g.items.map((i) => [i.id, i.name])),
);

export const LOCATION_PRESETS: Record<Location, { label: string; description: string; equipment: string[] }> = {
  palestra: {
    label: 'Palestra attrezzata',
    description: 'Macchine, pesi liberi e cardio',
    equipment: ALL_EQUIPMENT_IDS,
  },
  casa: {
    label: 'A casa con qualche attrezzo',
    description: 'Manubri, elastici, magari una panca',
    equipment: ['tappetino', 'sedia', 'manubri', 'elastici', 'miniband'],
  },
  corpo_libero: {
    label: 'Solo corpo libero',
    description: 'Ti serve solo un tappetino',
    equipment: ['tappetino', 'sedia'],
  },
  personalizzata: {
    label: 'Scelgo io gli attrezzi',
    description: 'Segni uno per uno cosa hai a disposizione',
    equipment: ['tappetino'],
  },
};

/** Equipment requirement entries can be "a|b" (either). */
export function hasEquipment(required: string[], available: Set<string>): boolean {
  return required.every((req) => req.split('|').some((r) => available.has(r)));
}
