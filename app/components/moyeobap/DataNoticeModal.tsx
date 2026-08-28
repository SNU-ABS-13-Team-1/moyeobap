import { DataNoticeContent } from './DataNoticeContent';
import { Modal } from './Modal';

interface DataNoticeModalProps {
  onClose: () => void;
}

export function DataNoticeModal({ onClose }: DataNoticeModalProps) {
  return (
    <Modal onClose={onClose} title="데이터 이용 안내">
      <DataNoticeContent />
    </Modal>
  );
}
