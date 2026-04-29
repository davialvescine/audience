import { redirect } from 'next/navigation';

export default async function EventSettingsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/admin/events/${slug}`);
}
