import { PoemDetail } from './PoemDetail';
import { Id } from '../../../convex/_generated/dataModel';
export { generateMetadata } from './metadata';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ share?: string }>;
}) {
  const { id } = await params;
  const { share } = (await searchParams) ?? {};
  return <PoemDetail poemId={id as Id<'poems'>} shareSlug={share} />;
}
