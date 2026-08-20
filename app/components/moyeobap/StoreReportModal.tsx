"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

interface StoreReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  onSuccess?: (message: string) => void;
}

export function StoreReportModal({
  isOpen,
  onClose,
  restaurantName,
  onSuccess,
}: StoreReportModalProps) {
  const { currentUser, openAuth } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      openAuth();
      return;
    }

    const trimmed = content.trim();
    if (trimmed.length < 5) {
      setError("달라진 정보를 5자 이상 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `[매장 정보 수정 제보: ${restaurantName}] ${trimmed}`,
          pagePath: `${window.location.pathname}${window.location.search}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "제보를 보내지 못했어요.");
      }

      setContent("");
      onClose();
      if (onSuccess) {
        onSuccess("소중한 제보 감사합니다! 검토 후 반영할게요. 💌");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "제보 전송 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card store-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-report-title"
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>📢</span>
            <div>
              <h2 id="store-report-title" className="modal-title" style={{ fontSize: "1.05rem", margin: 0 }}>
                매장 정보 수정 제보
              </h2>
              <p className="modal-subtitle" style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                <strong>{restaurantName}</strong>의 달라진 정보를 알려주세요.
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="닫기">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="store-report-form">
          <div className="store-report-body" style={{ marginTop: "12px" }}>
            <textarea
              className="store-report-textarea"
              placeholder="예: 메뉴 가격이 변경되었어요 (순대국밥 10,000원 ➔ 11,000원), 최소주문금액이나 영업시간이 바뀌었어요 등"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
              }}
              rows={4}
              maxLength={1000}
              disabled={isSubmitting}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "0.88rem",
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <div className="store-report-counter" style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "right", marginTop: "4px" }}>
              {content.length}/1000자 (최소 5자)
            </div>

            {error && <p className="form-error" style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "4px" }}>{error}</p>}
          </div>

          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: "8px 14px", fontSize: "0.85rem", borderRadius: "6px" }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || content.trim().length < 5}
              style={{ padding: "8px 18px", fontSize: "0.85rem", borderRadius: "6px" }}
            >
              {isSubmitting ? "전송 중..." : "제보하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
