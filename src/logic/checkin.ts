import type { BodyLog, ExerciseState, Profile, Program, Session } from '../types';
import { plannedBetween } from './progression';
import { getExercise } from '../data/exercises';

export interface CheckinReport {
  adherence: number; // 0..1
  sessionsDone: number;
  sessionsPlanned: number;
  weightStart?: number;
  weightNow?: number;
  weightDelta?: number;
  waistDelta?: number;
  improved: { name: string; from: string; to: string }[];
  avgRpe?: number;
  advice: string[];
  onTrack: 'sì' | 'quasi' | 'no' | 'n/d';
  /** Add 5 minutes of cardio to every session. */
  boostCardio: boolean;
}

export function buildCheckinReport(
  profile: Profile,
  program: Program,
  sessions: Session[],
  body: BodyLog[],
  states: ExerciseState[],
  now = new Date(),
): CheckinReport {
  const start = new Date(program.createdAt);
  const mine = sessions.filter((s) => s.programId === program.id);
  const sessionsPlanned = Math.max(1, plannedBetween(profile.trainingDays, start, now));
  const adherence = Math.min(1, mine.length / sessionsPlanned);

  const weights = body.filter((b) => b.weightKg).sort((a, b) => a.date.localeCompare(b.date));
  const weightStart = profile.weightKg;
  const weightNow = weights.at(-1)?.weightKg ?? profile.weightKg;
  const weightDelta = weightNow !== undefined ? +(weightNow - weightStart).toFixed(1) : undefined;
  const waists = body.filter((b) => b.waistCm).sort((a, b) => a.date.localeCompare(b.date));
  const waistStart = profile.waistCm ?? waists[0]?.waistCm;
  const waistDelta = waistStart && waists.length ? +((waists.at(-1)!.waistCm ?? waistStart) - waistStart).toFixed(1) : undefined;

  const improved = states
    .filter((s) => s.history.length >= 2)
    .map((s) => {
      const ex = getExercise(s.exerciseId);
      const first = s.history[0];
      const last = s.history.at(-1)!;
      if (ex.kind === 'carico' && last.weight !== first.weight) {
        const better = (ex.increment ?? 1) < 0 ? last.weight < first.weight : last.weight > first.weight;
        return better ? { name: ex.name, from: `${first.weight} kg`, to: `${last.weight} kg` } : null;
      }
      if (ex.kind === 'tempo' && (last.seconds ?? 0) > (first.seconds ?? 0)) {
        return { name: ex.name, from: `${first.seconds}s`, to: `${last.seconds}s` };
      }
      if (ex.kind !== 'tempo' && last.bestReps > first.bestReps) {
        return { name: ex.name, from: `${first.bestReps} rip.`, to: `${last.bestReps} rip.` };
      }
      return null;
    })
    .filter((x): x is { name: string; from: string; to: string } => x !== null);

  const rpes = mine.map((s) => s.rpe).filter((r) => r > 0);
  const avgRpe = rpes.length ? +(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : undefined;

  const advice: string[] = [];
  const weeks = Math.max(1, (now.getTime() - start.getTime()) / (7 * 864e5));
  let onTrack: CheckinReport['onTrack'] = 'n/d';
  let boostCardio = false;

  if (adherence < 0.6) {
    advice.push(
      `Hai fatto ${mine.length} allenamenti su ${sessionsPlanned} previsti. Meglio meno giorni ma costanti: valuta di ridurre i giorni a settimana dal Profilo.`,
    );
  } else if (adherence >= 0.85) {
    advice.push('Costanza ottima: è il fattore che conta di più. Continua così.');
  }

  if (avgRpe !== undefined && avgRpe >= 8.5) {
    advice.push('Le sedute risultano molto faticose. Dormi a sufficienza e non saltare i giorni di riposo.');
  }

  if (weightDelta !== undefined) {
    const ratePerWeek = (weightDelta / weightStart / weeks) * 100;
    if (profile.goal === 'dimagrimento') {
      if (weightDelta >= 0) {
        onTrack = 'no';
        boostCardio = true;
        advice.push('Il peso non è sceso. Aumentiamo la parte cardio di 5 minuti; per l\'alimentazione il riferimento giusto è un nutrizionista.');
      } else if (ratePerWeek < -1) {
        onTrack = 'quasi';
        advice.push('Stai perdendo peso molto in fretta (più dell\'1% a settimana): rischi di perdere anche muscolo. Parlane con un nutrizionista.');
      } else {
        onTrack = 'sì';
        advice.push(`Stai perdendo circa ${Math.abs(ratePerWeek).toFixed(1).replace('.', ',')}% di peso a settimana: è il ritmo giusto.`);
      }
      if (profile.targetWeightKg && weightNow !== undefined) {
        const left = +(weightNow - profile.targetWeightKg).toFixed(1);
        if (left > 0) advice.push(`Mancano ${String(left).replace('.', ',')} kg all'obiettivo di ${profile.targetWeightKg} kg.`);
        else advice.push('Hai raggiunto il peso obiettivo! Puoi passare a un obiettivo di tonificazione o forza.');
      }
    } else if (profile.goal === 'massa') {
      onTrack = weightDelta > 0 ? 'sì' : improved.length > 0 ? 'quasi' : 'no';
      if (weightDelta <= 0) advice.push('Il peso è fermo: per costruire muscolo serve mangiare a sufficienza. Un nutrizionista può aiutarti.');
    } else {
      onTrack = improved.length >= 3 ? 'sì' : improved.length > 0 ? 'quasi' : 'no';
    }
  }

  if (improved.length === 0 && mine.length >= 4) {
    advice.push('Nessun esercizio è ancora migliorato: assicurati di registrare carichi e ripetizioni reali in ogni serie.');
  } else if (improved.length > 0) {
    advice.push(`Sei migliorato in ${improved.length} esercizi${improved.length === 1 ? 'o' : ''}.`);
  }

  return {
    adherence, sessionsDone: mine.length, sessionsPlanned, weightStart, weightNow, weightDelta, waistDelta,
    improved, avgRpe, advice, onTrack, boostCardio,
  };
}
