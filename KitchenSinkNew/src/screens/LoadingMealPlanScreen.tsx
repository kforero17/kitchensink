import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type LoadingMealPlanScreenProps = NativeStackNavigationProp<RootStackParamList, 'LoadingMealPlan'>;

const LoadingMealPlanScreen: React.FC = () => {
  const navigation = useNavigation<LoadingMealPlanScreenProps>();
  const spinValue = new Animated.Value(0);

  // Create the spinning animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Navigate to MealPlan screen after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('MealPlan');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Interpolate the spin value to rotate from 0 to 360 degrees
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Create an array of utensils with their angles
  const utensils = [
    { icon: 'silverware-fork', angle: '0deg' },
    { icon: 'silverware-spoon', angle: '120deg' },
    { icon: 'silverware-variant', angle: '240deg' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.spinningContainer, { transform: [{ rotate: spin }] }]}>
          {utensils.map((utensil, index) => (
            <Animated.View
              key={index}
              style={[
                styles.utensilContainer,
                {
                  transform: [
                    { rotate: utensil.angle },
                    { translateX: 50 }, // Radius of the circle
                  ],
                },
              ]}
            >
              <Icon
                name={utensil.icon}
                size={30}
                color="#007bff"
                style={{ transform: [{ rotate: `-${utensil.angle}` }] }}
              />
            </Animated.View>
          ))}
        </Animated.View>
        <Text style={styles.loadingText}>Generating your meal plan...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  spinningContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  utensilContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 40,
    fontSize: 18,
    color: '#007bff',
    fontWeight: '600',
  },
});

export default LoadingMealPlanScreen; 