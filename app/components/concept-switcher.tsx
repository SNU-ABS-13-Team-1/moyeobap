"use client";

import { useSearchParams, useRouter } from "next/navigation";

export type ConceptMode =
  | "hot-dashboard"
  | "main"
  | "live-lounge"
  | "roulette"
  | "pinboard"
  | "split-dashboard"
  | "quick-deck";

interface ConceptOption {
  id: ConceptMode;
  label: string;
  branch: string;
  description: string;
  isRecommended?: boolean;
}

const CONCEPTS: ConceptOption[] = [
  {
    id: "hot-dashboard",
    label: "🔥 모여밥 통합 완성판",
    branch: "feature/hot-dashboard-ui",
    description: "마감임박 카운트다운 카드 + 테이블 뷰 + 0초 슬라이드 드로어 + 룰렛 모달",
    isRecommended: true,
  },
  {
    id: "main",
    label: "기본 메인 (비교용)",
    branch: "main",
    description: "오리지널 표준 카드 목록 & 페이지 직접 이동 방식",
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
        <span className="concept-switcher-label">화면 비교</span>

        <nav className="concept-switcher-tabs" aria-label="화면 비교 전환">
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
                {concept.isRecommended && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">추천</span>}
                {isActive && <small className="branch-tag">{concept.branch}</small>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="concept-hint-banner">
        <span>💡 현재 선택: <strong>{currentConcept.label}</strong> ({currentConcept.branch}) — {currentConcept.description}</span>
      </div>
    </div>
  );
}
