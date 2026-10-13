export interface ApplyCompany {
  id: string;
  name: string;
}

export interface ApplySubmission {
  choices: string[];
  academicRank: number | null;
  editCount: number;
  updatedAt: string;
}

export interface ApplyParticipant {
  displayName: string;
  choices: string[];
  isMe: boolean;
  // Omitted by the database when the viewer has not shared their own rank.
  academicRank?: number | null;
}

export interface ApplyState {
  companies: ApplyCompany[];
  submission: ApplySubmission | null;
  // null means the caller has not submitted and has no access to this list.
  participants: ApplyParticipant[] | null;
}

export interface ApplySaveResult {
  submission: ApplySubmission;
  changed: boolean;
}

export type ApplySort = 'name' | 'company' | 'academicRank';

export function sortApplyParticipants(
  participants: ApplyParticipant[],
  names: ReadonlyMap<string, string>,
  sort: ApplySort,
  canViewAcademicRanks: boolean,
) {
  return [...participants].sort((a, b) => {
    // Even a stale or manipulated sort selection must not reveal rank ordering.
    if (sort === 'academicRank' && canViewAcademicRanks) {
      const byRank = (a.academicRank ?? Infinity) - (b.academicRank ?? Infinity);
      if (byRank) return byRank;
    }
    if (sort === 'company') {
      const byCompany = (names.get(a.choices[0]) ?? '').localeCompare(names.get(b.choices[0]) ?? '', 'ko');
      if (byCompany) return byCompany;
    }
    return a.displayName.localeCompare(b.displayName, 'ko');
  });
}

/** Existing incomplete submissions remain readable; every new save needs five choices. */
export function validateApplyChoices(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 5) {
    return '1지망부터 5지망까지 모두 선택해주세요.';
  }
  if (value.some((choice) => typeof choice !== 'string' || !choice.trim() || choice.length > 100)) {
    return '1지망부터 순서대로 기업을 선택해주세요. 중간 순위는 비울 수 없어요.';
  }
  if (new Set(value).size !== value.length) {
    return '같은 기업을 중복으로 선택할 수 없어요.';
  }
  return null;
}

export function validateApplyAcademicRank(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    return '석차는 1 이상의 정수로 입력하거나 비워두세요.';
  }
  return null;
}
