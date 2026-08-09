"use client";

import { useSearchParams, useRouter } from "next/navigation";

export type ConceptMode =
  | "hot-dashboard"
  | "live-lounge"
  | "main"
  | "split-dashboard"
  | "quick-deck";

interface ConceptOption {
  id: ConceptMode;
  label: string;
  branch: string;
  description: string;
}

const CONCEPTS: ConceptOption[] = [
  {
    id: "hot-dashboard",
    label: "🔥 마감임박 & 테이블",
    branch: "feature/hot-dashboard-ui",
    description: "🔥 마감 임박 카운트다운 카드 + 전체 모집 테이블 & 플로팅 팟 개설 UI",
  },
  {
    id: "live-lounge",
    label: "라이브 라운지",
    branch: "feature/live-lounge-app",
    description: "페이지 이동 0초! 슬라이드 드로어 형태의 파티룸 UI",
  },
  {
    id: "main",
    label: "기본 메인",
    branch: "main",
    description: "표준 카드 목록 + 상세 페이지 이동 방식",
  },
  {
    id: "split-dashboard",
    label: "2컬럼 대시보드",
    branch: "feature/ux-improvements",
    description: "좌측 목록 + 우측 상세의 2컬럼 대시보드 스플릿 뷰",
  },
  {
    id: "quick-deck",
    label: "퀵 매치 덱",
    branch: "feature/quick-match-deck-ui",
    description: "마감 임박 팟 스와이프 추천 카드 덱",
  },
];

export function ConceptSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConcept = (searchParams.get("concept") as ConceptMode) || "hot-dashboard";

  const currentConcept = CONCEPTS.find((c) => c.id === activeConcept) ?? CONCEPTS[0];

  const handleSelect = (id: ConceptMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("concept", id);
    router.replace(`/?${params.toString()}`);
  };

  return (
    <div className="concept-switcher-bar">
      <div className="concept-switcher-container">
        <span className="concept-switcher-label">브랜치 화면 비교</span>

        <nav className="concept-switcher-tabs" aria-label="아이디어 브랜치 전환">
          {CONCEPTS.map((concept) => {
            const isActive = activeConcept === concept.id;
            return (
              <button
                key={concept.id}
                type="button"
                className={`concept-tab ${isActive ? "active" : ""}`}
                onClick={() => handleSelect(concept.id)}
                title={`브랜치: ${concept.branch} — ${concept.description}`}
              >
                <span>{concept.label}</span>
                {isActive && <small className="branch-tag">{concept.branch}</small>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="concept-hint-banner">
        <span>💡 현재 선택된 UI: <strong>{currentConcept.label}</strong> ({currentConcept.branch}) — {currentConcept.description}</span>
      </div>
    </div>
  );
}
