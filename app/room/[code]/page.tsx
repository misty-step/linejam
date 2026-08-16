import { RoomPage } from './RoomPage';

interface RoomPageRouteProps {
  params: Promise<{ code: string }>;
}

export default async function RoomRoutePage({ params }: RoomPageRouteProps) {
  const { code } = await params;
  return <RoomPage code={code} />;
}
