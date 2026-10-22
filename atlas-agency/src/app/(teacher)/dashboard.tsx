import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { lightTheme as theme } from '@/theme/tokens';

// Placeholder: built out in step 8.
export default function TeacherDashboard() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('teacher.dashboard')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, backgroundColor: theme.background },
  title: { fontSize: 28, fontWeight: '700', color: theme.text },
});
