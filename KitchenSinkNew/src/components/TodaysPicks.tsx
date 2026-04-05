import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { PredictedMeal, predictTodaysMeals } from '../services/predictionService';
import { logRecipeDismissed } from '../services/recoLoggingService';
import {
  getDietaryPreferences,
  getFoodPreferences,
  getCookingPreferences,
  getBudgetPreferences,
} from '../utils/preferences';
import { UserPreferences } from '../types/FirestoreSchema';
import { theme } from '../styles/theme';
import logger from '../utils/logger';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ConfidenceLevel = 'low' | 'medium' | 'high';

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

const CONFIDENCE_DOT_COUNT = 3;

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const ConfidenceDots: React.FC<{ level: ConfidenceLevel }> = ({ level }) => {
  const filledCount = level === 'high' ? 3 : level === 'medium' ? 2 : 1;

  return (
    <View style={styles.confidenceContainer}>
      {Array.from({ length: CONFIDENCE_DOT_COUNT }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.confidenceDot,
            i < filledCount ? styles.confidenceDotFilled : styles.confidenceDotEmpty,
          ]}
        />
      ))}
    </View>
  );
};

const ReasonChip: React.FC<{ reason: string }> = ({ reason }) => (
  <View style={styles.reasonChip}>
    <Text style={styles.reasonChipText} numberOfLines={1}>
      {reason}
    </Text>
  </View>
);

const MealCard: React.FC<{
  meal: PredictedMeal;
  onPress: () => void;
}> = ({ meal, onPress }) => {
  const confidenceLevel = getConfidenceLevel(meal.confidence);
  const label = MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.mealTypeLabel}>{label}</Text>
        <ConfidenceDots level={confidenceLevel} />
      </View>
      <Text style={styles.recipeTitle} numberOfLines={2}>
        {meal.recipe.title}
      </Text>
      {meal.reasons.length > 0 && (
        <View style={styles.reasonsRow}>
          {meal.reasons.map((reason, index) => (
            <ReasonChip key={index} reason={reason} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
};

export const TodaysPicks: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [predictions, setPredictions] = useState<PredictedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const loadPredictions = useCallback(async () => {
    try {
      const [dietary, food, cooking, budget] = await Promise.all([
        getDietaryPreferences(),
        getFoodPreferences(),
        getCookingPreferences(),
        getBudgetPreferences(),
      ]);

      if (!dietary || !food || !cooking || !budget) {
        setPredictions([]);
        return;
      }

      const prefs: UserPreferences = {
        dietary,
        food,
        cooking,
        budget,
      };

      const meals = await predictTodaysMeals(prefs);
      setPredictions(meals);
    } catch (error) {
      logger.error('[TodaysPicks] Failed to load predictions', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    for (const meal of predictions) {
      try {
        await logRecipeDismissed(meal.recipe.id);
      } catch (error) {
        logger.error('[TodaysPicks] Failed to log dismiss', error);
      }
    }
  }, [predictions]);

  const handleCardPress = useCallback(
    (meal: PredictedMeal) => {
      navigation.navigate('RecipeDetail', { recipe: meal.recipe });
    },
    [navigation],
  );

  if (dismissed) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (predictions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{'\u{1F4A1}'} Today's Picks</Text>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.dismissButtonText}>{'\u2715'}</Text>
        </TouchableOpacity>
      </View>
      {predictions.map((meal) => (
        <MealCard
          key={meal.mealType}
          meal={meal}
          onPress={() => handleCardPress(meal)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  loadingContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSizes.heading,
    fontWeight: '600',
    color: '#fff',
  },
  dismissButton: {
    padding: 4,
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.7,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealTypeLabel: {
    fontSize: theme.typography.fontSizes.small,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeTitle: {
    fontSize: theme.typography.fontSizes.large,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceDotFilled: {
    backgroundColor: theme.colors.success,
  },
  confidenceDotEmpty: {
    backgroundColor: theme.colors.neutral,
  },
  reasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reasonChip: {
    backgroundColor: theme.colors.primary + '15',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reasonChipText: {
    fontSize: theme.typography.fontSizes.small,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default TodaysPicks;
