import { DownloadsScreen } from '@/features/offline/DownloadsScreen';
import { offlineRuntime } from '@/offline/runtime';

export default function Downloads() {
  return <DownloadsScreen load={offlineRuntime} />;
}
