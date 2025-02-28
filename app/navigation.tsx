import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import SensorData from "@/components/SensorData";
import AlertLogs from "@/components/AlertLogs";
import LiveStream from "@/components/LiveStream";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={SensorData} />
      <Stack.Screen name="AlertLogs" component={AlertLogs} />
      <Stack.Screen name="LiveStream" component={LiveStream} /> 

    </Stack.Navigator>
  );
}
