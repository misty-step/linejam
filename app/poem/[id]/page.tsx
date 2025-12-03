import { PoemDetail } from './PoemDetail';
import { Id } from '../../../convex/_generated/dataModel';
export { generateMetadata } from './metadata';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PoemDetail poemId={id as Id<'poems'>} />;
}
