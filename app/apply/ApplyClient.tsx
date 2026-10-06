'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/moyeobap/AuthProvider';
import { Modal } from '../components/moyeobap/Modal';
import { ApiError, getErrorMessage, requestJson } from '../lib/api-client';
import type {
  ApplyCompany,
  ApplyParticipant,
  ApplySaveResult,
  ApplyState,
  ApplySubmission,
} from '../lib/moyeoApply';
import styles from './apply.module.css';

const RANKS = [1, 2, 3, 4, 5] as const;

function savedTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function ApplyClient() {
  const { currentUser, isAuthLoading, openAuth } = useAuth();

  return (
    <main className={`page-content ${styles.page}`}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>함께 나누는 다음 선택</p>
        <h1>모여 어플라이</h1>
        <p className={styles.subtitle}>캡스톤 기업 지망 공유</p>
      </header>

      <section aria-label="이용 안내" className={styles.intro}>
        <p className={styles.introLead}>
          서로의 선택에 도움이 되도록 현재 생각하는 지망을 솔직하게 공유해주세요.
          {' '}다른 사람의 선택을 유도하기 위한 허위 지망 입력은 삼가주세요.
          {' '}제출 후 수정은 최대 2회 가능합니다.
        </p>
        <ul>
          <li>내 지망을 제출하면 다른 제출자의 지망을 볼 수 있습니다.</li>
          <li>내 표시 이름과 지망도 다른 제출자에게 공개됩니다.</li>
          <li>이곳의 공유 내용은 공식 신청에 반영되지 않습니다. 공식 지망은 별도로 제출해야 합니다.</li>
        </ul>
      </section>

      {isAuthLoading ? (
        <div className={styles.state} role="status">로그인 상태를 확인하는 중이에요...</div>
      ) : currentUser ? (
        <AuthenticatedApply key={currentUser.id} />
      ) : (
        <section className={`${styles.card} ${styles.login}`}>
          <span aria-hidden="true" className={styles.loginIcon}>↗</span>
          <h2>나의 선택부터 공유해보세요</h2>
          <p>모여밥 계정으로 로그인하면 내 지망을 작성할 수 있어요.</p>
          <button className={styles.primaryButton} onClick={() => openAuth('/apply')} type="button">
            Google로 로그인
          </button>
        </section>
      )}
    </main>
  );
}

function AuthenticatedApply() {
  const [state, setState] = useState<ApplyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const mounted = useRef(false);

  const load = useCallback((signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    return requestJson<ApplyState>('/api/apply', { cache: 'no-store', signal })
      .then((next) => {
        if (mounted.current && sequence === requestSequence.current) {
          setState(next);
          setReadError(null);
        }
      })
      .catch((error: unknown) => {
        if (mounted.current && !signal?.aborted && sequence === requestSequence.current) {
          setReadError(getErrorMessage(error, '지망을 불러오지 못했어요. 다시 시도해주세요.'));
          if (error instanceof ApiError && error.status === 401) setState(null);
        }
      })
      .finally(() => {
        if (mounted.current && sequence === requestSequence.current) setLoading(false);
      });
  }, []);

  function refresh() {
    setLoading(true);
    setReadError(null);
    void load();
  }

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      mounted.current = false;
      controller.abort();
      requestSequence.current += 1;
    };
  }, [load]);

  async function save(choices: string[]) {
    if (!state || saving || loading) return null;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const result = await requestJson<ApplySaveResult>('/api/apply', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choices, expectedEditCount: state.submission?.editCount ?? null }),
      });
      if (!mounted.current) return null;
      // 저장 응답으로 먼저 확정합니다. 뒤의 목록 조회 실패가 저장 실패로 보이지 않게 합니다.
      setState((previous) => previous ? { ...previous, submission: result.submission } : previous);
      setNotice(result.changed ? '내 지망을 저장했어요.' : '변경된 내용이 없어 수정 횟수를 사용하지 않았어요.');
      refresh();
      return result;
    } catch (error) {
      if (!mounted.current) return null;
      setSaveError(getErrorMessage(error, '지망을 저장하지 못했어요. 다시 시도해주세요.'));
      if (error instanceof ApiError && (error.status === 403 || error.status === 409)) refresh();
      if (error instanceof ApiError && error.status === 401) setState(null);
      return null;
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  if (!state) {
    return (
      <div className={`${styles.card} ${styles.state}`}>
        {loading ? <p role="status">내 지망을 불러오는 중이에요...</p> : (
          <>
            <p className={styles.error} role="alert">{readError ?? saveError ?? '지망을 불러오지 못했어요.'}</p>
            <button className={styles.secondaryButton} onClick={refresh} type="button">다시 시도</button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {saveError && <p className={styles.errorBanner} role="alert">{saveError}</p>}
      <MySubmission
        busy={saving || loading}
        companies={state.companies}
        key={state.submission?.updatedAt ?? 'unsubmitted'}
        onSave={save}
        saving={saving}
        submission={state.submission}
      />

      {state.submission ? (
        <Participants
          companies={state.companies}
          error={readError}
          loading={loading}
          onRefresh={refresh}
          participants={state.participants}
          saving={saving}
        />
      ) : readError ? (
        <div className={styles.errorBanner} role="alert">
          <p>{readError}</p>
          <button className={styles.secondaryButton} disabled={loading} onClick={refresh} type="button">다시 시도</button>
        </div>
      ) : null}
    </>
  );
}

function MySubmission({ companies, submission, busy, saving, onSave }: {
  companies: ApplyCompany[];
  submission: ApplySubmission | null;
  busy: boolean;
  saving: boolean;
  onSave: (choices: string[]) => Promise<ApplySaveResult | null>;
}) {
  const [editing, setEditing] = useState(!submission);
  const [draft, setDraft] = useState<string[]>(RANKS.map((_, index) => submission?.choices[index] ?? ''));
  const [confirming, setConfirming] = useState(false);
  const remaining = Math.max(0, 2 - (submission?.editCount ?? 0));
  const choices = draft.filter(Boolean);
  const changed = choices.join('|') !== (submission?.choices ?? []).join('|');
  const names = new Map(companies.map((company) => [company.id, company.name]));

  function changeChoice(index: number, value: string) {
    setDraft((previous) => previous.map((choice, position) => {
      if (position === index) return value;
      if (!value && position > index) return '';
      return choice;
    }));
  }

  function moveChoice(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (busy || !draft[index] || !draft[target]) return;
    setDraft((previous) => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    document.getElementById(`apply-rank-${target + 1}`)?.focus();
  }

  function cancel() {
    setDraft(RANKS.map((_, index) => submission?.choices[index] ?? ''));
    setEditing(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !choices.length || !changed || (submission && remaining === 0)) return;
    setConfirming(true);
  }

  async function confirmSave() {
    setConfirming(false);
    const result = await onSave(choices);
    if (result) setEditing(false);
  }

  return (
    <section aria-labelledby="my-apply-heading" className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="my-apply-heading">내 지망</h2>
          <p>{submission ? '공유 중인 나의 캡스톤 기업 지망이에요.' : '1지망은 꼭 선택하고, 아직 고민 중인 순위는 미정으로 두세요.'}</p>
        </div>
        <span className={remaining ? styles.remaining : styles.locked}>남은 수정 횟수 {remaining}회</span>
      </div>

      <form onSubmit={submit}>
        <div className={styles.choices}>
          {RANKS.map((rank, index) => (
            <div className={styles.choice} key={rank}>
              <div className={styles.rankHeading}>
                <label htmlFor={editing ? `apply-rank-${rank}` : undefined}>
                  {rank}지망 {rank === 1 && editing && <span className={styles.required}>필수</span>}
                </label>
                {editing && (
                  <span className={styles.rankActions}>
                    <button
                      aria-label={`${rank}지망 순위 올리기`}
                      disabled={busy || !draft[index] || !draft[index - 1]}
                      onClick={() => moveChoice(index, -1)}
                      title="순위 올리기"
                      type="button"
                    >↑</button>
                    <button
                      aria-label={`${rank}지망 순위 내리기`}
                      disabled={busy || !draft[index] || !draft[index + 1]}
                      onClick={() => moveChoice(index, 1)}
                      title="순위 내리기"
                      type="button"
                    >↓</button>
                  </span>
                )}
              </div>
              {editing ? (
                <select
                  disabled={busy || (index > 0 && !draft[index - 1])}
                  id={`apply-rank-${rank}`}
                  onChange={(event) => changeChoice(index, event.target.value)}
                  required={rank === 1}
                  value={draft[index]}
                >
                  <option value="">{rank === 1 ? '기업 선택' : '미정'}</option>
                  {companies.map((company) => (
                    <option disabled={draft.some((choice, position) => choice === company.id && position !== index)} key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={!submission?.choices[index] ? styles.undecided : styles.choiceValue}>
                  {names.get(submission?.choices[index] ?? '') ?? '미정'}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && <p className={styles.hint}>↑↓로 선택한 기업의 순서를 바꿀 수 있어요. 저장할 때 수정 1회가 사용됩니다(최초 제출 제외). 중간 순위를 미정으로 바꾸면 뒤 순위도 미정으로 바뀝니다.</p>}
        {submission && remaining === 0 && <p className={styles.hint}>수정 2회를 모두 사용했어요. 다른 제출자의 지망은 계속 확인할 수 있어요.</p>}

        <div className={styles.formFooter}>
          <p className={styles.savedAt}>
            {submission ? <>마지막 저장 <time dateTime={submission.updatedAt}>{savedTime(submission.updatedAt)}</time> · 한국 시간</> : '아직 제출하지 않았어요. 최초 제출은 수정 횟수에 포함되지 않습니다.'}
          </p>
          <div className={styles.actions}>
            {editing ? (
              <>
                {submission && <button className={styles.secondaryButton} disabled={busy} onClick={cancel} type="button">취소</button>}
                <button className={styles.primaryButton} disabled={busy || !choices.length || !changed} type="submit">
                  {saving ? '저장 중...' : submission ? '변경 저장' : '내 지망 제출'}
                </button>
              </>
            ) : remaining > 0 ? (
              <button className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(true)} type="button">지망 수정</button>
            ) : <span className={styles.editLocked}>수정 완료</span>}
          </div>
        </div>
      </form>

      {confirming && (
        <Modal
          footer={(
            <div className={styles.confirmActions}>
              <button className={styles.secondaryButton} onClick={() => setConfirming(false)} type="button">돌아가기</button>
              <button className={styles.primaryButton} disabled={busy} onClick={() => void confirmSave()} type="button">{submission ? '변경 저장' : '제출하고 공유하기'}</button>
            </div>
          )}
          onClose={() => setConfirming(false)}
          title={submission ? '지망을 변경할까요?' : '내 지망을 공유할까요?'}
        >
          <div className={styles.confirmBody}>
            <p>{submission ? `이번 변경을 저장하면 남은 수정 횟수는 ${remaining - 1}회입니다.` : '제출하면 내 표시 이름과 지망이 다른 제출자에게 공개됩니다. 제출 후에는 최대 2회 수정할 수 있어요.'}</p>
            <ol className={styles.confirmChoices}>
              {RANKS.map((rank, index) => <li key={rank}><span>{rank}지망</span><strong>{names.get(choices[index]) ?? '미정'}</strong></li>)}
            </ol>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Participants({ companies, participants, loading, saving, error, onRefresh }: {
  companies: ApplyCompany[];
  participants: ApplyParticipant[] | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [sort, setSort] = useState<'name' | 'company'>('name');
  const hasFilters = Boolean(search.trim() || company);
  const names = useMemo(() => new Map(companies.map((item) => [item.id, item.name])), [companies]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    return (participants ?? [])
      .filter((participant) => participant.displayName.toLocaleLowerCase('ko-KR').includes(query)
        && (!company || participant.choices.includes(company)))
      .sort((a, b) => {
        if (sort === 'company') {
          const byCompany = (names.get(a.choices[0]) ?? '').localeCompare(names.get(b.choices[0]) ?? '', 'ko');
          if (byCompany) return byCompany;
        }
        return a.displayName.localeCompare(b.displayName, 'ko');
      });
  }, [participants, search, company, sort, names]);

  return (
    <section aria-labelledby="apply-participants-heading" className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="apply-participants-heading">
            참여자 목록{' '}
            <span aria-live="polite" className={styles.count}>
              {!loading && !error && participants && (hasFilters
                ? `전체 ${participants.length}명 중 ${filtered.length}명`
                : `${participants.length}명`)}
            </span>
          </h2>
          <p>현재 공유한 지망이에요. 기업을 고르면 해당 지망을 강조해요.</p>
        </div>
        <button className={styles.secondaryButton} disabled={loading || saving} onClick={onRefresh} type="button">
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      <div className={styles.filters}>
        <label className={styles.search}>
          <span>이름 검색</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="표시 이름으로 검색" type="search" value={search} />
        </label>
        <label className={styles.companyFilter}>
          <span>기업 필터 · 1~5지망 전체</span>
          <select onChange={(event) => setCompany(event.target.value)} value={company}>
            <option value="">모든 기업</option>
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className={styles.sortFilter}>
          <span>정렬</span>
          <select onChange={(event) => setSort(event.target.value === 'company' ? 'company' : 'name')} value={sort}>
            <option value="name">이름순</option>
            <option value="company">1지망 기업순</option>
          </select>
        </label>
        {hasFilters && (
          <button
            className={styles.secondaryButton}
            onClick={() => { setSearch(''); setCompany(''); }}
            type="button"
          >검색·필터 초기화</button>
        )}
      </div>

      {error ? (
        <div className={styles.state}>
          <p className={styles.error} role="alert">{error}</p>
          <p>목록을 다시 불러와주세요. 저장된 내 지망은 위에서 확인할 수 있어요.</p>
          <button className={styles.secondaryButton} disabled={loading} onClick={onRefresh} type="button">다시 시도</button>
        </div>
      ) : loading ? (
        <div className={styles.state} role="status">참여자 목록을 불러오는 중이에요...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>캡스톤 기업 지망 공유 참여자 {filtered.length}명의 현재 지망</caption>
            <thead><tr><th scope="col">표시 이름</th>{RANKS.map((rank) => <th key={rank} scope="col">{rank}지망</th>)}</tr></thead>
            <tbody>
              {filtered.length ? filtered.map((participant, index) => (
                <tr className={participant.isMe ? styles.myRow : undefined} key={`${participant.displayName}-${index}`}>
                  <th scope="row">{participant.displayName}{participant.isMe && <span className={styles.meBadge}>나</span>}</th>
                  {RANKS.map((rank, position) => (
                    <td className={!participant.choices[position] ? styles.undecided : undefined} key={rank}>
                      {company && participant.choices[position] === company
                        ? <mark className={styles.companyMatch}>{names.get(company)}</mark>
                        : names.get(participant.choices[position]) ?? '미정'}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td className={styles.emptyTable} colSpan={6}>{search || company ? '검색 조건에 맞는 참여자가 없어요.' : '아직 표시할 참여자가 없어요.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
