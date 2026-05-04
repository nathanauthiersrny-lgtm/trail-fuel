import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import FoodItemFormScreen from '@/screens/FoodItemFormScreen';

export default function FoodItemFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: id ? 'Modifier item' : 'Nouvel item' });
  }, [id, navigation]);

  return <FoodItemFormScreen id={id} />;
}
