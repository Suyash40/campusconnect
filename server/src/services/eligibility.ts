export interface EligibilityCriteria {
  branches?: string[] | null;
  years?: number[] | null;
}

export interface StudentProfile {
  branch: string;
  year: number | null;
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Hard filter. An empty list means "open to all". A student with an incomplete
 * profile fails a restricted criterion rather than being shown as eligible.
 */
export function checkEligibility(criteria: EligibilityCriteria | null | undefined, student: StudentProfile): EligibilityResult {
  const branches = criteria?.branches ?? [];
  const years = criteria?.years ?? [];
  if (branches.length > 0) {
    if (!student.branch) return { eligible: false, reason: 'Add your branch in profile to check eligibility' };
    if (!branches.some((b) => norm(b) === norm(student.branch))) {
      return { eligible: false, reason: `Open to ${branches.join(', ')} only` };
    }
  }
  if (years.length > 0) {
    if (student.year === null) return { eligible: false, reason: 'Add your academic year in profile to check eligibility' };
    if (!years.includes(student.year)) {
      return { eligible: false, reason: `Open to year ${years.join(', ')} only` };
    }
  }
  return { eligible: true };
}
