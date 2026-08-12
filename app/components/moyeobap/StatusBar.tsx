interface StatusBarProps {
  activePotsCount: number;
  totalParticipantsCount: number;
}

export function StatusBar({
  activePotsCount,
  totalParticipantsCount,
}: StatusBarProps) {
  return (
    <div aria-live="polite" className="status-bar">
      <div className="status-bar__item">
        <span className="status-bar__dot status-bar__dot--live"></span>
        <span>진행중인 팟</span>
        <span className="status-bar__count">{activePotsCount}</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__dot status-bar__dot--total"></span>
        <span>총 참여인원</span>
        <span className="status-bar__count">{totalParticipantsCount}</span>
      </div>
    </div>
  );
}
