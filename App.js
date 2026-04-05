import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Appbar, Menu, Provider as PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HomeScreen from "./screens/js/HomeScreen";
import AudioScreen from "./screens/js/AudioScreen";
import ConversionsScreen from "./screens/js/ConversionsScreen";
import PhotoConverter from "./screens/js/PhotoConverter";
import LoginScreen from "./screens/js/LoginScreen";
import RegisterScreen from "./screens/js/RegisterScreen";
import { apiUrl } from "./lib/api";
import { theme } from "./screens/styles/theme";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const navigationRef = useRef(null);

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      console.log("Token retrieved from AsyncStorage:", token); // Depuración
      if (token) {
        const response = await fetch(apiUrl("/user"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        console.log("Fetch user response status:", response.status); // Depuración
        if (response.ok) {
          const data = await response.json();
          console.log("User data:", data); // Depuración
          setUser(data.email);
        } else {
          console.log("Invalid token, removing it");
          await AsyncStorage.removeItem("token");
          setUser(null);
        }
      } else {
        console.log("No token found");
        setUser(null);
      }
    } catch (error) {
      console.error("Error al obtener el usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const handleLoginSuccess = (email) => {
    console.log("Login success, setting user:", email); // Depuración
    setUser(email);
    navigationRef.current?.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  const handleLogout = async () => {
    try {
      console.log("Logging out, removing token");
      await AsyncStorage.removeItem("token");
      setUser(null);
      setMenuVisible(false);
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const Header = ({ navigation }) => (
    <Appbar.Header style={styles.headerContainer}>
      <Appbar.Content
        style={styles.headerTitleCustom}
        title="🎵 EasyTunr"
        color="white"
        onPress={() => navigation.navigate("Home")}
      />
      {user && (
        <>
          <Appbar.Action
            icon="microphone"
            color="#FFFFFF"
            onPress={() => navigation.navigate("Audio")}
          />
          <Appbar.Action
            icon="camera"
            color="#FFFFFF"
            onPress={() => navigation.navigate("Photo")}
          />
          <Appbar.Action
            icon="folder"
            color="#FFFFFF"
            onPress={() => navigation.navigate("Conversions")}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Appbar.Action
                icon="account-circle"
                color="#FFFFFF"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item style={styles.menuItem} title={`Hola, ${user}`} disabled />
            <Menu.Item style={styles.menuItem} title="Cerrar Sesión" onPress={handleLogout} />
          </Menu>
        </>
      )}
    </Appbar.Header>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <NavigationContainer
          ref={navigationRef}
          key={user ? "logged-in" : "logged-out"}
        >
          <Stack.Navigator
            initialRouteName={user ? "Home" : "Login"}
            screenOptions={({ navigation }) => ({
              header: () => <Header navigation={navigation} />,
              headerTitleAlign: "center",
            })}
          >
            <Stack.Screen
              name="Login"
              children={(props) => (
                <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />
              )}
            />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Audio" component={AudioScreen} />
            <Stack.Screen name="Photo" component={PhotoConverter} />
            <Stack.Screen name="Conversions" component={ConversionsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "#5E3CD6",
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#7B61DA",
  },
  headerTitleCustom: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  userContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    backgroundColor: "#ffffff20",
    borderRadius: 5,
  },
  userName: {
    color: "white",
    fontSize: 16,
    marginRight: 10,
  },
  userButtonText: {
    fontSize: 18,
    color: "white",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  menuItem: {
    fontSize: 18,
    marginVertical: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
  },
});
