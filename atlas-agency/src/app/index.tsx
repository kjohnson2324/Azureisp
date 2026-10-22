import { Redirect } from 'expo-router';

// Until auth lands (step 7/8 edge functions), send everyone to student HQ.
export default function Index() {
  return <Redirect href="/hq" />;
}
