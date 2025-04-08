import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("token", data.token);
        Alert.alert("Login exitoso", "Bienvenido de nuevo");
        navigation.navigate("Home");
      } else {
        // Mostrar mensaje de error específico
        if (data.message) {
          setErrorMessage(data.message);
        } else {
          setErrorMessage("Error desconocido. Intenta nuevamente.");
        }
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setErrorMessage("Hubo un problema al conectar con el servidor.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        returnKeyType="next" // Cambia el botón Enter a "Siguiente"
        onSubmitEditing={() => {
          // Mover el foco al campo de contraseña
          this.passwordInput.focus();
        }}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="done" // Cambia el botón Enter a "Hecho"
        onSubmitEditing={handleLogin} // Llama a handleLogin al presionar Enter
        ref={(input) => {
          this.passwordInput = input;
        }}
      />
      <Button title="Iniciar Sesión" onPress={handleLogin} />
      <Button
        title="¿No tienes cuenta? Regístrate"
        onPress={() => navigation.navigate("Register")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  error: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
});

export default LoginScreen;