import { PotDetailPageClient } from '../../components/moyeobap/PotDetailPageClient';

export default async function PotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PotDetailPageClient potId={id} />;
}
