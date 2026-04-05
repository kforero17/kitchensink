import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { RootStackParamList } from '../navigation/AppNavigator';
import { fetchWeeklyInsights } from '../services/insightsService';
import { logInsightsViewed, logInsightsShared } from '../services/analyticsService';
import { WeeklyInsightsData } from '../types/InsightsData';
import InsightCard from '../components/InsightCard';
import { theme } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WeeklyInsights'>;

const ACCENT_COLOR = '#C4B5A4';
const TEXT_COLOR = '#2C2C2C';
const BACKGROUND_COLOR = '#F5F2ED';
const screenWidth = Dimensions.get('window').width - 64;

const chartConfig = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  color: (opacity = 1) => `rgba(196, 181, 164, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(44, 44, 44, ${opacity})`,
  barPercentage: 0.6,
  decimalPlaces: 0,
  propsForLabels: { fontSize: 10 },
};

const WeeklyInsightsScreen: React.FC<Props> = ({ navigation }) => {
  const [insights, setInsights] = useState<WeeklyInsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const data = await fetchWeeklyInsights();
        setInsights(data);
        logInsightsViewed();
      } catch {
        Alert.alert('Error', 'Failed to load weekly insights.');
      } finally {
        setLoading(false);
      }
    };
    loadInsights();
  }, []);

  const handleShare = async () => {
    if (!insights) return;

    const totalMacros =
      insights.nutrition
        ? insights.nutrition.carbsGrams +
          insights.nutrition.proteinGrams +
          insights.nutrition.fatGrams
        : 0;

    const message = [
      '\uD83C\uDF73 My Kitchen Insights This Week:',
      `\uD83D\uDCB0 Saved ~$${insights.wasteAvoided.thisWeekSaved} by using items before they expired`,
      `\uD83C\uDF7D\uFE0F Cooked ${insights.recipesThisWeek} recipes this week`,
      insights.nutrition && totalMacros > 0
        ? `\uD83D\uDCCA Avg ${insights.nutrition.avgCaloriesPerDay} cal/day (${Math.round(
            (insights.nutrition.carbsGrams / totalMacros) * 100,
          )}% carbs, ${Math.round(
            (insights.nutrition.proteinGrams / totalMacros) * 100,
          )}% protein, ${Math.round(
            (insights.nutrition.fatGrams / totalMacros) * 100,
          )}% fat)`
        : null,
      `\uD83D\uDD25 ${insights.streak.currentStreak}-week cooking streak!`,
      '',
      'Powered by KitchenHelper',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({ message, title: 'My Kitchen Insights' });
      logInsightsShared();
    } catch {
      Alert.alert('Error', 'Failed to share insights.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </View>
    );
  }

  if (!insights) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.emptyText}>No insights available yet.</Text>
      </View>
    );
  }

  const wasteDiff = insights.wasteAvoided.thisWeekSaved - insights.wasteAvoided.lastWeekSaved;
  const wasteUp = wasteDiff >= 0;

  const spendDiff = insights.spendingTrends.thisWeekSpend - insights.spendingTrends.averageWeeklySpend;
  const spendBelow = spendDiff <= 0;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Insights</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
          <Ionicons name="share-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Waste Avoided Card */}
        <InsightCard title="Waste Avoided" icon="leaf-outline">
          <Text style={styles.bigNumber}>${insights.wasteAvoided.thisWeekSaved}</Text>
          <Text style={styles.bigNumberLabel}>saved this week</Text>
          <Text
            style={[
              styles.comparison,
              { color: wasteUp ? theme.colors.success : theme.colors.error },
            ]}
          >
            {wasteUp ? '\u2191' : '\u2193'} ${Math.abs(wasteDiff)} vs $
            {insights.wasteAvoided.lastWeekSaved} last week
          </Text>
          <View style={styles.chartContainer}>
            <BarChart
              data={{
                labels: insights.wasteAvoided.weeklyTrend.map((w) => w.weekLabel),
                datasets: [{ data: insights.wasteAvoided.weeklyTrend.map((w) => w.amountSaved) }],
              }}
              width={screenWidth}
              height={180}
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel="$"
              yAxisSuffix=""
            />
          </View>
        </InsightCard>

        {/* Spending Trends Card */}
        <InsightCard title="Spending Trends" icon="cart-outline">
          <Text style={styles.bigNumber}>${insights.spendingTrends.thisWeekSpend}</Text>
          <Text style={styles.bigNumberLabel}>this week</Text>
          <Text
            style={[
              styles.comparison,
              { color: spendBelow ? theme.colors.success : theme.colors.error },
            ]}
          >
            {spendBelow ? '\u2193' : '\u2191'} ${Math.abs(spendDiff)} vs $
            {insights.spendingTrends.averageWeeklySpend} average
          </Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: insights.spendingTrends.weeklyTrend.map((w) => w.weekLabel),
                datasets: [
                  { data: insights.spendingTrends.weeklyTrend.map((w) => w.estimatedSpend) },
                ],
              }}
              width={screenWidth}
              height={180}
              chartConfig={chartConfig}
              style={styles.chart}
              bezier
              yAxisLabel="$"
              yAxisSuffix=""
            />
          </View>
        </InsightCard>

        {/* Nutrition Summary Card */}
        <InsightCard title="Nutrition Summary" icon="nutrition-outline">
          {insights.nutrition ? (
            <>
              <Text style={styles.bigNumber}>
                {insights.nutrition.totalCalories.toLocaleString()} cal
              </Text>
              <Text style={styles.bigNumberLabel}>
                total this week ({insights.nutrition.avgCaloriesPerDay} cal/day avg)
              </Text>

              <View style={styles.pieContainer}>
                <PieChart
                  data={[
                    {
                      name: 'Protein',
                      grams: insights.nutrition.proteinGrams,
                      color: '#4ECDC4',
                      legendFontColor: TEXT_COLOR,
                      legendFontSize: 12,
                    },
                    {
                      name: 'Carbs',
                      grams: insights.nutrition.carbsGrams,
                      color: '#FFE66D',
                      legendFontColor: TEXT_COLOR,
                      legendFontSize: 12,
                    },
                    {
                      name: 'Fat',
                      grams: insights.nutrition.fatGrams,
                      color: '#FF6B6B',
                      legendFontColor: TEXT_COLOR,
                      legendFontSize: 12,
                    },
                  ]}
                  width={screenWidth}
                  height={180}
                  chartConfig={chartConfig}
                  accessor="grams"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  absolute
                />
              </View>

              <View style={styles.macroRow}>
                <MacroBadge label="Protein" grams={insights.nutrition.proteinGrams} color="#4ECDC4" />
                <MacroBadge label="Carbs" grams={insights.nutrition.carbsGrams} color="#FFE66D" />
                <MacroBadge label="Fat" grams={insights.nutrition.fatGrams} color="#FF6B6B" />
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No recipes cooked this week</Text>
          )}
        </InsightCard>

        {/* Streak Card */}
        <InsightCard title="Cooking Streak" icon="flame-outline">
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={40} color="#FF9500" />
            <View style={styles.streakText}>
              <Text style={styles.streakNumber}>{insights.streak.currentStreak}</Text>
              <Text style={styles.streakLabel}>week streak!</Text>
            </View>
          </View>
          <Text style={styles.streakDetail}>
            Longest streak: {insights.streak.longestStreak} weeks
          </Text>
          <Text style={styles.streakDetail}>
            {insights.recipesThisWeek} recipes cooked this week
          </Text>
        </InsightCard>
      </ScrollView>
    </View>
  );
};

/* ------------------------------------------------------------------ */
/*  Small helper component for macro badges                           */
/* ------------------------------------------------------------------ */

const MacroBadge: React.FC<{ label: string; grams: number; color: string }> = ({
  label,
  grams,
  color,
}) => (
  <View style={styles.macroBadge}>
    <View style={[styles.macroDot, { backgroundColor: color }]} />
    <Text style={styles.macroText}>
      {label}: {grams}g
    </Text>
  </View>
);

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: BACKGROUND_COLOR,
  },
  headerButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.fontSizes.heading,
    fontWeight: '600',
    color: TEXT_COLOR,
  },

  /* Scroll */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },

  /* Big numbers */
  bigNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginTop: theme.spacing.xs,
  },
  bigNumberLabel: {
    fontSize: theme.typography.fontSizes.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  comparison: {
    fontSize: theme.typography.fontSizes.medium,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },

  /* Charts */
  chartContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  chart: {
    borderRadius: theme.borderRadius.medium,
  },
  pieContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },

  /* Macro badges */
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.sm,
  },
  macroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.xs,
  },
  macroText: {
    fontSize: theme.typography.fontSizes.small,
    color: TEXT_COLOR,
    fontWeight: '500',
  },

  /* Streak */
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  streakText: {
    marginLeft: theme.spacing.sm,
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  streakLabel: {
    fontSize: theme.typography.fontSizes.large,
    color: theme.colors.textSecondary,
  },
  streakDetail: {
    fontSize: theme.typography.fontSizes.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },

  /* Empty state */
  emptyText: {
    fontSize: theme.typography.fontSizes.medium,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
});

export default WeeklyInsightsScreen;
