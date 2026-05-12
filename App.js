import React, { useState, useEffect, useRef, useCallback } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { View, StyleSheet, ActivityIndicator, AppState } from "react-native";
import { Appbar, Menu, Provider as PaperProvider, Divider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import HomeScreen from "./screens/js/HomeScreen";
import AudioScreen from "./screens/js/AudioScreen";
import ConversionsScreen from "./screens/js/ConversionsScreen";
import PhotoConverter from "./screens/js/PhotoConverter";
import LoginScreen from "./screens/js/LoginScreen";
import RegisterScreen from "./screens/js/RegisterScreen";
import { apiUrl } from "./lib/api";
import {
  clearAuthSession,
  getAuthSession,
  getValidAccessToken,
  markAuthActivity,
  refreshAuthSessionIfNeeded,
  shouldRefreshSession,
} from "./lib/authSession";
import { theme } from "./screens/styles/theme";

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const navigationRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const handleActivity = useCallback(() => {
    markAuthActivity().catch(() => {});
  }, []);

  const fetchUser = async () => {
    try {
      const token = await getValidAccessToken();
      console.log("Token retrieved from session helper:", token); // Depuración
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
          await clearAuthSession();
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

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        handleActivity();
        const token = await refreshAuthSessionIfNeeded(false);
        if (!token) {
          const session = await getAuthSession();
          if (!session.token) {
            setUser(null);
          }
        }
      }
    });

    refreshTimerRef.current = setInterval(async () => {
      const session = await getAuthSession();
      if (!session.token) {
        return;
      }

      const now = Date.now();
      const expired = session.expiresAt && session.expiresAt <= now;
      const idleTooLong = session.lastActivityAt && now - session.lastActivityAt > 10 * 60 * 1000;

      if (expired || idleTooLong) {
        await clearAuthSession();
        setUser(null);
        return;
      }

      if (await shouldRefreshSession()) {
        await refreshAuthSessionIfNeeded(false);
      }
    }, 60 * 1000);

    return () => {
      appStateSubscription.remove();
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [handleActivity]);

  const handleLoginSuccess = (email) => {
    console.log("Login success, setting user:", email); // Depuración
    setUser(email);
    handleActivity();
    navigationRef.current?.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  const handleLogout = async () => {
    try {
      console.log("Logging out, removing token");
      await clearAuthSession();
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
          <Appbar.Action
            icon="logout"
            color="#FFFFFF"
            onPress={handleLogout}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            contentStyle={styles.userMenu}
            anchor={
              <Appbar.Action
                icon="account-circle"
                color="#FFFFFF"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item title={`Hola, ${user}`} disabled titleStyle={styles.userMenuTitle} />
            <Menu.Item title="Ver perfil" disabled titleStyle={styles.userMenuSubtitle} />
            <Divider />
            <Menu.Item
              title="Cerrar sesión"
              onPress={handleLogout}
              leadingIcon="logout"
              titleStyle={styles.logoutTitle}
            />
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
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={handleActivity} onMouseMove={handleActivity}>
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
  userMenu: {
    marginTop: 8,
    borderRadius: 16,
    minWidth: 220,
    paddingVertical: 6,
    backgroundColor: "#1f1538",
  },
  userMenuTitle: {
    color: "#F8FAFC",
    fontWeight: "700",
  },
  userMenuSubtitle: {
    color: "#C7D2FE",
    opacity: 0.8,
    fontSize: 12,
  },
  logoutTitle: {
    color: "#FECACA",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
  },
});
