"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from "react";
import {
  CURRENT_USER,
  INITIAL_RECRUITMENTS,
  OrderPeriod,
  Participant,
  Recruitment,
  getRestaurant,
} from "@/app/lib/prototype-data";

type CreateRecruitmentInput = {
  restaurantId: string;
  period: OrderPeriod;
  deadline: string;
};

type CreateResult =
  | { ok: true; recruitmentId: string }
  | { ok: false; duplicateId: string };

type PrototypeContextValue = {
  currentUser: Participant | null;
  recruitments: Recruitment[];
  notice: string;
  login: () => void;
  logout: () => void;
  clearNotice: () => void;
  joinRecruitment: (recruitmentId: string) => boolean;
  leaveRecruitment: (recruitmentId: string) => void;
  cancelRecruitment: (recruitmentId: string) => void;
  createRecruitment: (input: CreateRecruitmentInput) => CreateResult;
  requestRestaurant: () => void;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [recruitments, setRecruitments] = useState(INITIAL_RECRUITMENTS);
  const [notice, setNotice] = useState("");

  function login() {
    setCurrentUser(CURRENT_USER);
    setNotice("Slack 인증을 연결한 상태로 전환했어요. 실제 연동은 다음 단계에서 진행합니다.");
  }

  function logout() {
    setCurrentUser(null);
    setNotice("로그아웃했어요. 실시간 현황판은 계속 볼 수 있어요.");
  }

  function clearNotice() {
    setNotice("");
  }

  function joinRecruitment(recruitmentId: string) {
    if (!currentUser) {
      setNotice("참여하려면 Slack 인증이 필요해요.");
      return false;
    }

    setRecruitments((current) =>
      current.map((recruitment) => {
        if (recruitment.id !== recruitmentId || recruitment.status !== "open") {
          return recruitment;
        }
        if (
          recruitment.participants.some(
            (participant) => participant.id === currentUser.id,
          )
        ) {
          return recruitment;
        }

        return {
          ...recruitment,
          participants: [
            ...recruitment.participants,
            { ...currentUser, joinedAt: Date.now() },
          ],
        };
      }),
    );
    setNotice("공동주문에 참여했어요.");
    return true;
  }

  function leaveRecruitment(recruitmentId: string) {
    if (!currentUser) return;

    setRecruitments((current) =>
      current.map((recruitment) => {
        if (recruitment.id !== recruitmentId || recruitment.status !== "open") {
          return recruitment;
        }

        const remaining = recruitment.participants.filter(
          (participant) => participant.id !== currentUser.id,
        );

        if (remaining.length === 0) {
          return {
            ...recruitment,
            participants: [],
            status: "cancelled",
          };
        }

        const nextManager = [...remaining].sort(
          (a, b) => a.joinedAt - b.joinedAt,
        )[0];

        return {
          ...recruitment,
          participants: remaining,
          managerId:
            recruitment.managerId === currentUser.id
              ? nextManager.id
              : recruitment.managerId,
        };
      }),
    );
    setNotice("참여를 취소했어요. 관리자였다면 다음 참여자에게 자동 이임됐어요.");
  }

  function cancelRecruitment(recruitmentId: string) {
    if (!currentUser) return;

    setRecruitments((current) =>
      current.map((recruitment) =>
        recruitment.id === recruitmentId &&
        recruitment.managerId === currentUser.id &&
        recruitment.status === "open"
          ? { ...recruitment, status: "cancelled" }
          : recruitment,
      ),
    );
    setNotice("모집을 취소했어요.");
  }

  function createRecruitment(input: CreateRecruitmentInput): CreateResult {
    const duplicate = recruitments.find(
      (recruitment) =>
        recruitment.restaurantId === input.restaurantId &&
        recruitment.deadline === input.deadline &&
        recruitment.status === "open",
    );

    if (duplicate) {
      return { ok: false, duplicateId: duplicate.id };
    }

    const recruitmentId = `recruitment-${Date.now()}`;
    const creator = {
      ...(currentUser ?? CURRENT_USER),
      joinedAt: Date.now(),
    };

    setRecruitments((current) => [
      ...current,
      {
        id: recruitmentId,
        restaurantId: input.restaurantId,
        period: input.period,
        deadline: input.deadline,
        participants: [creator],
        managerId: creator.id,
        status: "open",
      },
    ]);
    setNotice("새 모집을 만들고 첫 참여자로 등록했어요.");
    return { ok: true, recruitmentId };
  }

  function requestRestaurant() {
    setNotice("매장 추가 요청은 다음 데이터 연결 단계에서 제공할 예정이에요.");
  }

  const value = {
    currentUser,
    recruitments,
    notice,
    login,
    logout,
    clearNotice,
    joinRecruitment,
    leaveRecruitment,
    cancelRecruitment,
    createRecruitment,
    requestRestaurant,
  };

  return (
    <PrototypeContext.Provider value={value}>
      {children}
    </PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const context = useContext(PrototypeContext);
  if (!context) {
    throw new Error("usePrototype must be used inside PrototypeProvider");
  }
  return context;
}

export function useRecruitment(recruitmentId: string) {
  const prototype = usePrototype();
  const recruitment = prototype.recruitments.find(
    (item) => item.id === recruitmentId,
  );
  const restaurant = recruitment
    ? getRestaurant(recruitment.restaurantId)
    : undefined;

  return { ...prototype, recruitment, restaurant };
}
