'use client';

import { useEffect, useRef, useState } from 'react';
import { ROLE_EMOJI, ROLE_LABEL, ROLE_SUMMARY, deckFor, type Role } from '../../lib/onenightMatch';

// 처음 하는 사람이 대부분이라, 방에 들어오면 제일 먼저 보이는 게 이 버튼입니다.
// 규칙을 다 적지 않고 "한 판을 따라가는 순서"로만 보여줍니다 — 길면 아무도 안 읽습니다.

const STEPS: { badge: string; title: string; body: string }[] = [
  {
    badge: '1',
    title: '카드를 받아요',
    body:
      '사람 수보다 3장 많은 카드를 섞어 한 장씩 나눠 갖고, 남은 3장은 가운데에 엎어 둬요. ' +
      '그래서 내 카드가 아닌 카드도 어딘가에 숨어 있어요.',
  },
  {
    badge: '2',
    title: '밤 — 각자 자기 일을 해요',
    body:
      '역할마다 밤에 하는 일이 달라요. 예언자는 남의 카드를 보고, 도둑은 카드를 바꾸고, ' +
      '말썽꾼은 남의 카드 둘을 몰래 바꿔요. 다 같이 동시에 고르면 끝나요.',
  },
  {
    badge: '3',
    title: '내 카드가 바뀌었을 수 있어요',
    body:
      '이 게임의 핵심이에요. 밤 사이에 누가 내 카드를 바꿔 갔을 수 있어서, ' +
      '늑대였던 사람이 늑대가 아니게 되기도 하고 반대로 나도 모르게 늑대가 되기도 해요.',
  },
  {
    badge: '4',
    title: '낮 — 이야기해요',
    body:
      '각자 자기 역할과 밤에 본 것을 말해요. 늑대는 당연히 거짓말을 해요. ' +
      '누가 거짓말인지 말을 맞춰 보면서 찾아내면 돼요.',
  },
  {
    badge: '5',
    title: '동시에 한 명을 지목해요',
    body:
      '가장 많이 지목된 사람이 죽어요. 표가 같으면 그 사람들 모두 죽고, ' +
      '전부 1표씩이면 아무도 안 죽어요.',
  },
];

const WIN_RULES: { who: string; tone: 'village' | 'wolf'; text: string }[] = [
  { who: '마을팀 승리', tone: 'village', text: '늑대인간이 한 명이라도 죽으면 이겨요.' },
  { who: '늑대팀 승리', tone: 'wolf', text: '늑대인간이 한 명도 안 죽으면 이겨요. 아무도 안 죽어도 늑대가 이겨요.' },
  {
    who: '늑대가 아무도 없을 때',
    tone: 'village',
    text: '늑대 카드 2장이 모두 가운데에 있을 수 있어요. 이때는 아무도 죽이지 않아야 마을이 이겨요.',
  },
];

const TIPS = [
  '예언자가 본 것은 밤 "초반"의 모습이에요. 그 뒤에 도둑·말썽꾼이 카드를 옮겼을 수 있어요.',
  '“저는 마을사람이에요”는 확인할 방법이 없는 말이에요. 그래서 늑대가 제일 많이 쓰는 변명이기도 해요.',
  '취객은 가운데 몇 번 카드를 가져왔는지 말해 주세요. 그 카드를 본 사람이 있으면 바로 밝혀져요.',
  '예언자라고 말하는 사람이 둘이면, 둘 중 하나는 반드시 거짓말이에요.',
];

export function OneNightRulebook({ playerCount }: { playerCount?: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'flow' | 'roles' | 'tips'>('flow');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 방에 있는 인원수에 맞는 덱을 보여줍니다. 아직 인원이 안 차면 5인 기준.
  const count = playerCount && playerCount >= 3 && playerCount <= 8 ? playerCount : 5;
  const deck = deckFor(count);
  const counted = deck.reduce<Partial<Record<Role, number>>>((acc, role) => {
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});
  const rolesInDeck = (Object.keys(counted) as Role[]).sort((a, b) => (counted[b] ?? 0) - (counted[a] ?? 0));

  return (
    <>
      <button className="onenight-rulebook__open" onClick={() => setOpen(true)} type="button">
        📖 규칙 보기
      </button>

      {open && (
        <div className="onenight-rulebook__backdrop" onClick={() => setOpen(false)} role="presentation">
          <div
            aria-labelledby="onenight-rulebook-title"
            aria-modal="true"
            className="onenight-rulebook"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <header className="onenight-rulebook__head">
              <div>
                <p className="onenight-rulebook__eyebrow">처음이어도 5분이면 돼요</p>
                <h2 id="onenight-rulebook-title">원나잇 인랑 규칙</h2>
              </div>
              <button aria-label="닫기" className="onenight-rulebook__close" onClick={() => setOpen(false)} ref={closeRef} type="button">
                ✕
              </button>
            </header>

            <p className="onenight-rulebook__lead">
              밤은 딱 한 번, 낮도 딱 한 번. <strong>한 명을 지목하면 그걸로 끝나는</strong> 짧은 마피아예요.
              죽어도 다음 판까지 기다릴 일이 없어요.
            </p>

            <div className="onenight-rulebook__tabs" role="tablist">
              <button
                aria-selected={tab === 'flow'}
                className={`onenight-rulebook__tab ${tab === 'flow' ? 'is-active' : ''}`}
                onClick={() => setTab('flow')}
                role="tab"
                type="button"
              >
                한 판 흐름
              </button>
              <button
                aria-selected={tab === 'roles'}
                className={`onenight-rulebook__tab ${tab === 'roles' ? 'is-active' : ''}`}
                onClick={() => setTab('roles')}
                role="tab"
                type="button"
              >
                역할 {count}인 기준
              </button>
              <button
                aria-selected={tab === 'tips'}
                className={`onenight-rulebook__tab ${tab === 'tips' ? 'is-active' : ''}`}
                onClick={() => setTab('tips')}
                role="tab"
                type="button"
              >
                요령
              </button>
            </div>

            <div className="onenight-rulebook__body">
              {tab === 'flow' && (
                <>
                  <ol className="onenight-rulebook__steps">
                    {STEPS.map((step) => (
                      <li key={step.badge}>
                        <span className="onenight-rulebook__badge" aria-hidden="true">{step.badge}</span>
                        <div>
                          <strong>{step.title}</strong>
                          <p>{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <h3 className="onenight-rulebook__subhead">누가 이기나요?</h3>
                  <ul className="onenight-rulebook__wins">
                    {WIN_RULES.map((rule) => (
                      <li className={`onenight-rulebook__win onenight-rulebook__win--${rule.tone}`} key={rule.who}>
                        <strong>{rule.who}</strong>
                        <span>{rule.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tab === 'roles' && (
                <>
                  <p className="onenight-rulebook__note">
                    {count}명이면 카드 {deck.length}장을 써요. 한 장씩 갖고 <strong>3장은 가운데</strong>에 남아요.
                  </p>
                  <ul className="onenight-rulebook__roles">
                    {rolesInDeck.map((role) => (
                      <li key={role}>
                        <span className="onenight-rulebook__role-emoji" aria-hidden="true">{ROLE_EMOJI[role]}</span>
                        <div>
                          <strong>
                            {ROLE_LABEL[role]}
                            {(counted[role] ?? 0) > 1 && <em className="onenight-rulebook__count"> ×{counted[role]}</em>}
                            {role === 'werewolf' && <span className="onenight-rulebook__tag onenight-rulebook__tag--wolf">늑대팀</span>}
                          </strong>
                          <p>{ROLE_SUMMARY[role]}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {tab === 'tips' && (
                <ul className="onenight-rulebook__tips">
                  {TIPS.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="onenight-rulebook__foot">
              <button className="onenight-btn onenight-btn--primary" onClick={() => setOpen(false)} type="button">
                알겠어요
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
