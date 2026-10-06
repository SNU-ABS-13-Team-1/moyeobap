export interface ApplyCompany {
  id: string;
  name: string;
}

export interface ApplySubmission {
  choices: string[];
  editCount: number;
  updatedAt: string;
}

export interface ApplyParticipant {
  displayName: string;
  choices: string[];
  isMe: boolean;
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

/** Optional ranks are omitted at the end; holes and duplicates are never stored. */
export function validateApplyChoices(value: unknown): string | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) {
    return '1지망부터 최대 5지망까지 선택해주세요.';
  }
  if (value.some((choice) => typeof choice !== 'string' || !choice.trim() || choice.length > 100)) {
    return '1지망부터 순서대로 기업을 선택해주세요. 중간 순위는 비울 수 없어요.';
  }
  if (new Set(value).size !== value.length) {
    return '같은 기업을 중복으로 선택할 수 없어요.';
  }
  return null;
}
