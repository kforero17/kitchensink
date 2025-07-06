import firestore from '@react-native-firebase/firestore';
import { ScoredRecipe } from '../ranking/rankRecipes';

/**
 * Compute ISO week start (Monday) date string YYYY-MM-DD for a given date.
 */
function startOfWeek(date: Date): string {
  // getDay(): 0 Sunday -> adjust to Monday
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // number to add to reach Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().substring(0, 10);
}

export async function saveWeeklyRanking(rankings: ScoredRecipe[], referenceDate: Date = new Date()): Promise<void> {
  const weekOf = startOfWeek(referenceDate);
  const rankingDoc = {
    weekOf,
    recipes: rankings.map(r => ({ id: r.recipe.id, score: parseFloat(r.score.toFixed(4)) }))
  };

  await firestore()
    .collection('weeklyRankings')
    .doc(weekOf)
    .set(rankingDoc, { merge: true });
} 