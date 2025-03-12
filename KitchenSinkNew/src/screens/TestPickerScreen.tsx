import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function TestPickerScreen() {
  const [selectedValue, setSelectedValue] = useState('apple');

  return (
    <View>
      <Text>Choose an item:</Text>
      <Picker
        selectedValue={selectedValue}
        onValueChange={(itemValue) => setSelectedValue(itemValue)}>
        <Picker.Item label="Apple" value="apple" />
        <Picker.Item label="Banana" value="banana" />
      </Picker>
    </View>
  );
} 