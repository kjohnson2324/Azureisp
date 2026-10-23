import { createContext, useContext, type ReactNode } from 'react';

import type { GradeBand } from '@/content/schemas';

/** A teacher-set trip from school to a public place, used by the distance tool. */
export interface ClassTrip {
  place: { en: string; es?: string };
  km: number;
}

export interface StudentSession {
  gradeBand: GradeBand;
  classTrip?: ClassTrip;
}

// Filled from the signed-in student's profile and class (steps 7–8). Until then
// the app behaves as a grade 3–5 student with no class trip.
const DEFAULT_SESSION: StudentSession = { gradeBand: '3-5' };

const StudentContext = createContext<StudentSession>(DEFAULT_SESSION);

export function StudentProvider({ value, children }: { value: StudentSession; children: ReactNode }) {
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export const useStudent = () => useContext(StudentContext);
