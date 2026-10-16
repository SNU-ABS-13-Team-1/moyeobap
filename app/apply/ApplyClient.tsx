'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../components/moyeobap/AuthProvider';
import { Modal } from '../components/moyeobap/Modal';
import { useApplyState } from '../hooks/useApplyState';
import type {
  ApplyCompany,
  ApplyParticipant,
  ApplySaveResult,
  ApplySubmission,
} from '../lib/moyeoApply';
import styles from './apply.module.css';
import { sortApplyParticipants, validateApplyAcademicRank, validateApplyChoices } from '../lib/moyeoApply';

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
          {' '}지망 저장 후 수정은 최대 2회 가능하며, 최종 확정하면 수정할 수 없습니다.
        </p>
        <ul>
          <li>내 지망을 제출하면 다른 제출자의 지망을 볼 수 있습니다.</li>
          <li>내 표시 이름과 지망도 다른 제출자에게 공개됩니다.</li>
          <li>1~5지망을 모두 선택해주세요. 석차는 선택사항이며, 입력해 저장한 사람끼리만 서로의 석차를 볼 수 있습니다.</li>
          <li>이곳의 공유 내용과 제출 완료 표시는 공식 신청에 반영되지 않습니다. 공식 지망은 별도로 제출해야 합니다.</li>
        </ul>
      </section>

      {isAuthLoading ? (
        <div className={styles.state} role="status">로그인 상태를 확인하는 중이에요...</div>
      ) : currentUser ? (
        <AuthenticatedApply key={currentUser.id} userId={currentUser.id} />
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

function AuthenticatedApply({ userId }: { userId: string }) {
  const { state, loading, saving, readError, saveError, notice, refresh, save, confirm, canViewAcademicRanks } = useApplyState(userId);

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
        onConfirm={confirm}
        saving={saving}
        submission={state.submission}
      />

      {state.submission ? (
        <Participants
          canViewAcademicRanks={canViewAcademicRanks}
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

function MySubmission({ companies, submission, busy, saving, onSave, onConfirm }: {
  companies: ApplyCompany[];
  submission: ApplySubmission | null;
  busy: boolean;
  saving: boolean;
  onSave: (choices: string[], academicRank: number | null) => Promise<ApplySaveResult | null>;
  onConfirm: () => Promise<ApplySaveResult | null>;
}) {
  const [editing, setEditing] = useState(!submission);
  const [draft, setDraft] = useState<string[]>(RANKS.map((_, index) => submission?.choices[index] ?? ''));
  const [rankDraft, setRankDraft] = useState(submission?.academicRank?.toString() ?? '');
  const [confirming, setConfirming] = useState(false);
  const [confirmingFinal, setConfirmingFinal] = useState(false);
  const isConfirmed = Boolean(submission?.confirmedAt);
  const remaining = Math.max(0, 2 - (submission?.editCount ?? 0));
  const choices = draft;
  const academicRank = rankDraft.trim() ? Number(rankDraft) : null;
  const activeCompanies = companies.filter((company) => company.isActive !== false);
  const hasRetiredChoice = choices.some((id) => companies.some((company) => company.id === id && company.isActive === false));
  const valid = !validateApplyChoices(choices) && !validateApplyAcademicRank(academicRank) && !hasRetiredChoice;
  const changed = choices.join('|') !== (submission?.choices ?? []).join('|')
    || academicRank !== (submission?.academicRank ?? null);
  const names = new Map(companies.map((company) => [company.id, company.name]));

  function changeChoice(index: number, value: string) {
    setDraft((previous) => previous.map((choice, position) => position === index ? value : choice));
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
    setRankDraft(submission?.academicRank?.toString() ?? '');
    setEditing(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !valid || !changed || (submission && remaining === 0)) return;
    setConfirming(true);
  }

  async function confirmSave() {
    setConfirming(false);
    const result = await onSave(choices, academicRank);
    if (result) setEditing(false);
  }

  return (
    <section aria-labelledby="my-apply-heading" className={styles.card}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="my-apply-heading">내 지망</h2>
          <p>{isConfirmed ? '제출 완료로 확정했어요. 지망과 석차는 더 이상 수정할 수 없어요.' : submission ? '공유 중인 지망을 확인하고 최종 확정해주세요.' : '1지망부터 5지망까지 서로 다른 기업을 모두 선택해주세요.'}</p>
        </div>
        <span className={isConfirmed ? styles.confirmedBadge : remaining ? styles.remaining : styles.locked}>{isConfirmed ? '제출 완료' : `남은 수정 횟수 ${remaining}회`}</span>
      </div>

      <form onSubmit={submit}>
        {editing && hasRetiredChoice && (
          <p role="status">선택 목록이 변경되었어요. 제외된 기업은 다른 항목으로, 기존 국가데이터처는 대전·서울·무차별 중 하나로 다시 선택해주세요.</p>
        )}
        <div className={styles.choices}>
          {RANKS.map((rank, index) => (
            <div className={styles.choice} key={rank}>
              <div className={styles.rankHeading}>
                <label htmlFor={editing ? `apply-rank-${rank}` : undefined}>
                  {rank}지망 {editing && <span className={styles.required}>필수</span>}
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
                  disabled={busy}
                  id={`apply-rank-${rank}`}
                  onChange={(event) => changeChoice(index, event.target.value)}
                  required
                  value={draft[index]}
                >
                  <option disabled value="">기업 선택</option>
                  {companies.some((company) => company.id === draft[index] && company.isActive === false) && (
                    <option disabled value={draft[index]}>{names.get(draft[index])} (다시 선택)</option>
                  )}
                  {activeCompanies.map((company) => (
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

        <div className={styles.academicRank}>
          <label htmlFor={editing ? 'apply-academic-rank' : undefined}>내 석차 <span>선택사항</span></label>
          {editing ? (
            <input
              aria-describedby="apply-academic-rank-hint"
              disabled={busy}
              id="apply-academic-rank"
              inputMode="numeric"
              min={1}
              max={2147483647}
              onChange={(event) => setRankDraft(event.target.value)}
              placeholder="예: 12"
              step={1}
              type="number"
              value={rankDraft}
            />
          ) : <p>{submission?.academicRank != null ? `${submission.academicRank}등` : '미입력'}</p>}
          <p className={styles.hint} id="apply-academic-rank-hint">석차를 입력해 저장하면 석차를 공유한 사람끼리만 서로의 석차를 확인할 수 있어요. 비워두면 지망 정보만 공유합니다.</p>
        </div>
        {editing && <p className={styles.hint}>↑↓로 선택한 기업의 순서를 바꿀 수 있어요. 지망이나 석차를 변경해 저장하면 수정 1회가 사용됩니다(최초 제출 제외).</p>}
        {submission && !isConfirmed && remaining === 0 && <p className={styles.hint}>수정 2회를 모두 사용했어요. 저장된 지망을 확인하고 최종 확정할 수 있어요.</p>}

        {submission && !isConfirmed && !editing && !valid && (
          <p className={styles.hint}>최종 확정하려면 현재 선택 가능한 기업으로 1~5지망을 모두 저장해야 해요.</p>
        )}
        <div className={styles.formFooter}>
          <p className={styles.savedAt}>
            {submission?.confirmedAt ? <>최종 확정 <time dateTime={submission.confirmedAt}>{savedTime(submission.confirmedAt)}</time> · 한국 시간</> : submission ? <>마지막 저장 <time dateTime={submission.updatedAt}>{savedTime(submission.updatedAt)}</time> · 한국 시간</> : '아직 제출하지 않았어요. 최초 제출은 수정 횟수에 포함되지 않습니다.'}
          </p>
          <div className={styles.actions}>
            {isConfirmed ? <span className={styles.editLocked}>최종 확정됨</span> : editing ? (
              <>
                {submission && <button className={styles.secondaryButton} disabled={busy} onClick={cancel} type="button">취소</button>}
                <button className={styles.primaryButton} disabled={busy || !valid || !changed} type="submit">
                  {saving ? '저장 중...' : submission ? '변경 저장' : '내 지망 제출'}
                </button>
              </>
            ) : (
              <>
                {remaining > 0 && <button className={styles.secondaryButton} disabled={busy} onClick={() => setEditing(true)} type="button">지망 수정</button>}
                <button className={styles.primaryButton} disabled={busy || !valid} onClick={() => setConfirmingFinal(true)} type="button">제출 완료로 확정</button>
              </>
            )}
          </div>
        </div>
      </form>

      {confirmingFinal && submission && (
        <Modal
          title="제출 완료로 확정할까요?"
          onClose={() => setConfirmingFinal(false)}
          footer={(
            <div className={styles.confirmActions}>
              <button className={styles.secondaryButton} disabled={busy} onClick={() => setConfirmingFinal(false)} type="button">돌아가기</button>
              <button className={styles.primaryButton} disabled={busy} onClick={() => {
                setConfirmingFinal(false);
                void onConfirm();
              }} type="button">최종 확정</button>
            </div>
          )}
        >
          <div className={styles.confirmBody}>
            <p>확정하면 남은 수정 횟수와 관계없이 지망과 석차를 더 이상 수정할 수 없고, 확정을 취소할 수 없어요. 다른 참여자에게는 ‘제출 완료’로 표시됩니다.</p>
            <ol className={styles.confirmChoices}>
              {RANKS.map((rank, index) => <li key={rank}><span>{rank}지망</span><strong>{names.get(submission.choices[index]) ?? '미정'}</strong></li>)}
            </ol>
            <p className={styles.hint}>{submission.academicRank !== null ? `석차 ${submission.academicRank}등` : '석차 미입력'} · 확정은 수정 횟수를 사용하지 않습니다.</p>
            <p className={styles.hint}>이 버튼은 모여 어플라이의 공유 내용을 확정합니다. 공식 지망 신청은 별도로 제출해야 합니다.</p>
          </div>
        </Modal>
      )}

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
            <p className={styles.hint}>{academicRank !== null ? `석차 ${academicRank}등 · 석차를 입력한 제출자에게만 공개됩니다.` : '석차 미입력 · 다른 제출자의 석차는 볼 수 없습니다.'}</p>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Participants({ companies, participants, canViewAcademicRanks, loading, saving, error, onRefresh }: {
  companies: ApplyCompany[];
  participants: ApplyParticipant[] | null;
  canViewAcademicRanks: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [sort, setSort] = useState<'name' | 'company' | 'academicRank'>('name');
  if (!canViewAcademicRanks && sort === 'academicRank') setSort('name');
  const hasFilters = Boolean(search.trim() || company);
  const names = useMemo(() => new Map(companies.map((item) => [item.id, item.name])), [companies]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR');
    const matches = (participants ?? [])
      .filter((participant) => participant.displayName.toLocaleLowerCase('ko-KR').includes(query)
        && (!company || participant.choices.includes(company)));
    return sortApplyParticipants(matches, names, sort, canViewAcademicRanks);
  }, [participants, search, company, sort, names, canViewAcademicRanks]);

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
          <p>최종 확정한 참여자는 제출 완료로 표시돼요. 기업을 고르면 해당 지망을 강조해요.</p>
          <p>{canViewAcademicRanks ? '석차는 본인이 입력한 정보이며, 석차를 공유한 사람에게만 보여요.' : '내 석차를 입력해 저장하면 다른 석차 공유자의 석차도 확인할 수 있어요.'}</p>
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
            {companies.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className={styles.sortFilter}>
          <span>정렬</span>
          <select onChange={(event) => setSort(event.target.value === 'company' ? 'company' : event.target.value === 'academicRank' && canViewAcademicRanks ? 'academicRank' : 'name')} value={sort === 'academicRank' && !canViewAcademicRanks ? 'name' : sort}>
            <option value="name">이름순</option>
            <option value="company">1지망 기업순</option>
            {canViewAcademicRanks && <option value="academicRank">석차순</option>}
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
            <thead><tr><th scope="col">표시 이름</th><th scope="col">상태</th>{canViewAcademicRanks && <th className={styles.rankColumn} scope="col">석차</th>}{RANKS.map((rank) => <th key={rank} scope="col">{rank}지망</th>)}</tr></thead>
            <tbody>
              {filtered.length ? filtered.map((participant, index) => (
                <tr className={participant.isMe ? styles.myRow : undefined} key={`${participant.displayName}-${index}`}>
                  <th scope="row">{participant.displayName}{participant.isMe && <span className={styles.meBadge}>나</span>}</th>
                  <td><span className={participant.isConfirmed ? styles.confirmedBadge : styles.pendingBadge}>{participant.isConfirmed ? '제출 완료' : '미확정'}</span></td>
                  {canViewAcademicRanks && <td>{participant.academicRank != null ? `${participant.academicRank}등` : '미입력'}</td>}
                  {RANKS.map((rank, position) => (
                    <td className={!participant.choices[position] ? styles.undecided : undefined} key={rank}>
                      {company && participant.choices[position] === company
                        ? <mark className={styles.companyMatch}>{names.get(company)}</mark>
                        : names.get(participant.choices[position]) ?? '미정'}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td className={styles.emptyTable} colSpan={canViewAcademicRanks ? 8 : 7}>{search || company ? '검색 조건에 맞는 참여자가 없어요.' : '아직 표시할 참여자가 없어요.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
