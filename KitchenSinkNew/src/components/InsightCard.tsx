import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const ACCENT_COLOR = '#C4B5A4';
const TEXT_COLOR = '#2C2C2C';

type Props = {
  title: string;
  icon: string;
  children: React.ReactNode;
};

const InsightCard: React.FC<Props> = ({ title, icon, children }) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={ACCENT_COLOR}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSizes.large,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginLeft: theme.spacing.sm,
  },
});

export default InsightCard;
