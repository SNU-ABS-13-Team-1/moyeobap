import Link from 'next/link';
import { DataNoticeContent } from '../components/moyeobap/DataNoticeContent';

export const metadata = {
  title: '데이터 이용 안내 | 모여밥',
};

// Google Play 스토어 등록에 필요한 공개 개인정보 처리방침 URL입니다. 로그인
// 모달의 "자세히 보기"와 같은 내용을 로그인 없이도 볼 수 있게 페이지로
// 둡니다(DataNoticeContent 공유).
export default function PrivacyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">개인정보</p>
          <h1>데이터 이용 안내</h1>
        </div>
        <Link className="page-back-link" href="/">← 현황판으로</Link>
      </div>

      <div className="page-card">
        <DataNoticeContent />
      </div>
    </main>
  );
}
