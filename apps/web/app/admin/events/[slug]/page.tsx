import { redirect } from 'next/navigation';

type Params = { slug: string };

export default async function AdminEventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  redirect(`/admin/events/${slug}/settings`);
}
