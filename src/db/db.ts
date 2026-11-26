import Dexie, { type Table } from 'dexie';
import type { BodyLog, Checkin, ExerciseState, Photo, Profile, Program, Session } from '../types';

export class GiottoDB extends Dexie {
  profile!: Table<Profile, string>;
  programs!: Table<Program, number>;
  sessions!: Table<Session, number>;
  states!: Table<ExerciseState, string>;
  body!: Table<BodyLog, number>;
  photos!: Table<Photo, number>;
  checkins!: Table<Checkin, number>;

  constructor(name = 'giotto-pt') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      programs: '++id, createdAt',
      sessions: '++id, date, programId',
      states: 'exerciseId',
      body: '++id, date',
      photos: '++id, date',
      checkins: '++id, date, programId',
    });
  }
}

export const db = new GiottoDB();

export async function activeProgram(): Promise<Program | undefined> {
  const all = await db.programs.toArray();
  return all.filter((p) => p.active).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
