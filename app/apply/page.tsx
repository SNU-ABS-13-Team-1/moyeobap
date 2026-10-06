import type { Metadata } from 'next';
import { ApplyClient } from './ApplyClient';

export const metadata: Metadata = {
  title: '모여 어플라이 | 모여밥',
  description: '내 캡스톤 기업 지망을 공유하고 다른 제출자의 선택을 확인하세요.',
};

export default function ApplyPage() {
  return <ApplyClient />;
}
