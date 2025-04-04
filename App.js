import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "./screens/HomeScreen";
import AudioScreen from "./screens/AudioScreen";
import ConversionsScreen from "./screens/ConversionsScreen";
import PhotoConverter from "./screens/PhotoConverter";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";

const Stack = createStackNavigator();

export default function App() {
  const initialRoute = localStorage.getItem("token") ? "Home" : "Login";
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Audio" component={AudioScreen} />
        <Stack.Screen name="Photo" component={PhotoConverter} />
        <Stack.Screen name="Conversions" component={ConversionsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}