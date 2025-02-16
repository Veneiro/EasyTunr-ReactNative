import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "./screens/HomeScreen";
import AudioScreen from "./screens/AudioScreen";
import ConversionsScreen from "./screens/ConversionsScreen";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Audio" component={AudioScreen} />
        <Stack.Screen name="Conversions" component={ConversionsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
