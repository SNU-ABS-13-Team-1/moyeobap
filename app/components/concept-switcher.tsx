"use client";

import { useSearchParams, useRouter } from "next/navigation";

export type ConceptMode =
  | "main"
  | "live-lounge"
  | "split-dashboard"
  | "quick-deck"
  | "scratch-light";

interface ConceptOption {
  id: ConceptMode;
  label: string;
  branch: string;
  description: string;
}

const CONCEPTS: ConceptOption[] = [
  {
    id: "main",
    label: "📦 기본 그리드 메인",
    branch: "main",
    description: "표준 그리드 카드 + 클릭 시 상세 페이지로 이동하는 베이스라인",
  },
  {
    id: "live-lounge",
    label: "⚡ 0초 슬라이드 라운지",
    branch: "feature/live-lounge-app",
    description: "페이지 이동 0초! 우측 슬라이드 드로어 파티룸 UI",
  },
  {
    id: "split-dashboard",
    label: "📊 2컬럼 대시보드",
    branch: "feature/ux-improvements",
    description: "좌측 파티 목록 + 우측 고정 상세창을 한눈에 비교하는 대시보드",
  },
  {
    id: "quick-deck",
    label: "🎯 퀵 매치 스와이프 덱",
    branch: "feature/quick-match-deck-ui",
    description: "가장 마감 임박한 배달 팟 1초 퀵 탑승 추천 덱",
  },
  {
    id: "scratch-light",
    label: "🍊 오렌지 팝업 모달",
    branch: "scratch/moyeobap",
    description: "오렌지 그래디언트 + 중앙 팝업 모달 인터랙션 프로토타입",
  },
];

export function ConceptSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConcept = (searchParams.get("concept") as ConceptMode) || "main";

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
