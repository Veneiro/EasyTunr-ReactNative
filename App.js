import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Appbar, Menu, Provider as PaperProvider } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import HomeScreen from "./screens/HomeScreen";
import AudioScreen from "./screens/AudioScreen";
import ConversionsScreen from "./screens/ConversionsScreen";
import PhotoConverter from "./screens/PhotoConverter";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";

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
        const response = await fetch("http://localhost:5000/user", {
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
      console.log("Logging out, removing token"); // Depuración
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
    <Appbar.Header style={styles.header}>
      <Appbar.Content
        title="EasyTunr"
        onPress={() => navigation.navigate("Home")}
      />
      {user && (
        <>
          <Appbar.Action
            icon="microphone"
            onPress={() => navigation.navigate("Audio")}
          />
          <Appbar.Action
            icon="camera"
            onPress={() => navigation.navigate("Photo")}
          />
          <Appbar.Action
            icon="folder"
            onPress={() => navigation.navigate("Conversions")}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Appbar.Action
                icon="account-circle"
                color="white"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item title={`Hola, ${user}`} disabled />
            <Menu.Item title="Cerrar Sesión" onPress={handleLogout} />
          </Menu>
        </>
      )}
    </Appbar.Header>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    backgroundColor: "#6200ee",
    height: 60,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
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
  },
});
