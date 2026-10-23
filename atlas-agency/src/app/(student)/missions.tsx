import { useRouter } from 'expo-router';

import { CasesScreen } from '@/features/missions/CasesScreen';
import { offlineRuntime } from '@/offline/runtime';

export default function Missions() {
  const router = useRouter();
  return <CasesScreen load={offlineRuntime} onOpen={(id) => router.push({ pathname: '/case/[id]', params: { id } })} />;
}
