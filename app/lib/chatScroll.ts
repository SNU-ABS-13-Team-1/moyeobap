// 채팅 목록이 새 메시지를 따라 내려갈지 판단하는 기준입니다.
//
// 무조건 하단으로 끌어내리면 위로 올려 지난 대화를 읽는 중에 화면을 빼앗깁니다.
// 그렇다고 자동 스크롤을 아예 끄면 맨 아래에서 대화하던 사람이 새 메시지를
// 놓칩니다. 그래서 "이미 하단을 보고 있었는지"만 보고 그때만 따라갑니다.

/**
 * 하단에서 이만큼 이내면 아직 하단을 보고 있다고 봅니다(px).
 *
 * 스크롤 위치가 딱 떨어지는 경우가 드물어 약간의 여유가 필요하지만, 이모티콘
 * 한 장(140px)보다는 작아야 합니다. 그보다 크면 이모티콘 하나만큼 올려둔
 * 화면을 하단으로 오인해 도로 끌어내리게 됩니다.
 */
export const CHAT_FOLLOW_THRESHOLD_PX = 48;

export type ChatScrollMetrics = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

/** 목록이 (거의) 맨 아래까지 내려와 있는지. */
export function isChatAtBottom(
  { scrollTop, clientHeight, scrollHeight }: ChatScrollMetrics,
  thresholdPx: number = CHAT_FOLLOW_THRESHOLD_PX,
): boolean {
  // 확대/축소 상태에서는 브라우저가 분수 픽셀로 재서 남은 값이 음수로도
  // 나옵니다. 부등호로 두면 그 경우까지 함께 하단으로 처리됩니다.
  return scrollHeight - scrollTop - clientHeight <= thresholdPx;
}
