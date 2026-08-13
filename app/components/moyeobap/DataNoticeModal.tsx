import { Modal } from './Modal';

interface DataNoticeModalProps {
  onClose: () => void;
}

export function DataNoticeModal({ onClose }: DataNoticeModalProps) {
  return (
    <Modal onClose={onClose} title="데이터 이용 안내">
      <div className="data-notice">
        <p>
          모여밥은 서울대학교 빅데이터 핀테크 전문가과정 수업 프로젝트입니다.
          서비스 운영과 수업 발표를 위해 아래 정보를 수집·활용하며,
          <strong> 상업적으로 이용하지 않습니다.</strong>
        </p>

        <h4>수집하는 정보</h4>
        <ul>
          <li>Google 로그인 정보(이름, 이메일, 프로필 이미지)</li>
          <li>모집 생성·참여·채팅 등 서비스 이용 기록</li>
          <li>(선택) 정산용 은행명·계좌번호</li>
        </ul>

        <h4>활용 목적</h4>
        <ul>
          <li>공동주문 매칭 등 서비스 핵심 기능 제공</li>
          <li>수업 발표·보고서용 이용 현황 통계·분석 (인기 매장, 모집 성공률 등)</li>
        </ul>

        <h4>중요 사항</h4>
        <ul>
          <li>계좌번호는 채팅에서 본인이 공유를 눌렀을 때만 노출되며, 통계·분석 대상에서 제외합니다.</li>
          <li>수집한 정보를 외부 제3자에게 제공하거나 판매하지 않습니다.</li>
          <li>발표 자료에는 개인을 특정할 수 없는 형태로 가공한 통계만 사용합니다.</li>
        </ul>

        <p className="data-notice__contact">
          내 정보 삭제를 원하시면 프로필의 피드백 보내기로 요청해주세요.
        </p>
      </div>
    </Modal>
  );
}
