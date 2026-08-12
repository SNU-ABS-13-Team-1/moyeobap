import { PotDetailPageClient } from '../../components/moyeobap/PotDetailPageClient';

export default async function PotDetailPage({ params }: PageProps<'/pots/[id]'>) {
  const { id } = await params;
  return <PotDetailPageClient potId={id} />;
}
