import { useLocalSearchParams, useRouter } from 'expo-router';

import { CaseScreen } from '@/features/missions/CaseScreen';
import { offlineRuntime } from '@/offline/runtime';

export default function Case() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <CaseScreen missionId={id} load={offlineRuntime} onExit={() => router.replace('/missions')} />;
}
