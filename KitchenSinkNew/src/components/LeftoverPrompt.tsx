import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { recordLeftover } from '../services/leftoverService';
import logger from '../utils/logger';

interface LeftoverPromptProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  recipeName: string;
  totalServings: number;
  mealType: string;
}

const LeftoverPrompt: React.FC<LeftoverPromptProps> = ({
  visible,
  onClose,
  recipeId,
  recipeName,
  totalServings,
  mealType,
}) => {
  const effectiveServings = totalServings > 0 ? totalServings : 4;
  const [portionsEaten, setPortionsEaten] = useState(effectiveServings);

  useEffect(() => {
    setPortionsEaten(effectiveServings);
  }, [effectiveServings]);

  const handleIncrement = () => {
    setPortionsEaten(prev => Math.min(prev + 1, effectiveServings));
  };

  const handleDecrement = () => {
    setPortionsEaten(prev => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    try {
      await recordLeftover(recipeId, recipeName, effectiveServings, portionsEaten, mealType);
      logger.debug(
        `[LeftoverPrompt] Recorded: ${recipeName}, ate ${portionsEaten}/${effectiveServings}`,
      );
    } catch (error) {
      logger.error('[LeftoverPrompt] Failed to record leftover', error);
    }
    resetAndClose();
  };

  const handleSkip = () => {
    resetAndClose();
  };

  const resetAndClose = () => {
    setPortionsEaten(effectiveServings);
    onClose();
  };

  const leftoverCount = effectiveServings - portionsEaten;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="food-variant" size={28} color="#D9A15B" />
            <Text style={styles.title}>How many servings did you eat?</Text>
          </View>

          {/* Recipe name */}
          <Text style={styles.recipeName} numberOfLines={2}>
            {recipeName}
          </Text>

          {/* Counter */}
          <View style={styles.counterSection}>
            <TouchableOpacity
              style={[styles.counterButton, portionsEaten <= 0 && styles.counterButtonDisabled]}
              onPress={handleDecrement}
              disabled={portionsEaten <= 0}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="minus"
                size={24}
                color={portionsEaten <= 0 ? '#C4B5A4' : '#FFFFFF'}
              />
            </TouchableOpacity>

            <View style={styles.counterDisplay}>
              <Text style={styles.counterValue}>{portionsEaten}</Text>
              <Text style={styles.counterLabel}>out of {effectiveServings}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.counterButton,
                portionsEaten >= effectiveServings && styles.counterButtonDisabled,
              ]}
              onPress={handleIncrement}
              disabled={portionsEaten >= effectiveServings}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="plus"
                size={24}
                color={portionsEaten >= effectiveServings ? '#C4B5A4' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Leftover indicator */}
          {leftoverCount > 0 && (
            <View style={styles.leftoverIndicator}>
              <MaterialCommunityIcons name="fridge-outline" size={18} color="#B57A42" />
              <Text style={styles.leftoverText}>
                {leftoverCount} {leftoverCount === 1 ? 'serving' : 'servings'} will be saved as
                leftovers
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.7}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E4E4E',
    marginLeft: 10,
    flex: 1,
  },
  recipeName: {
    fontSize: 15,
    color: '#7A736A',
    marginBottom: 20,
    marginLeft: 38,
  },
  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  counterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D9A15B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterButtonDisabled: {
    backgroundColor: '#E6DED3',
  },
  counterDisplay: {
    alignItems: 'center',
    marginHorizontal: 32,
  },
  counterValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#4E4E4E',
  },
  counterLabel: {
    fontSize: 14,
    color: '#7A736A',
    marginTop: 2,
  },
  leftoverIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  leftoverText: {
    fontSize: 14,
    color: '#B57A42',
    marginLeft: 8,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E6DED3',
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7A736A',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#D9A15B',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default LeftoverPrompt;
