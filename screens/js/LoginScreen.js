import React, { useState } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreenView from "../views/LoginScreenView";

const LoginScreen = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch("http://192.168.1.13:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem("token", data.token);
        onLoginSuccess(data.email);
      } else {
        setErrorMessage(data.message || "Error desconocido. Intenta nuevamente.");
      }
    } catch (error) {
      setErrorMessage("Hubo un problema al conectar con el servidor.");
    }
  };

  return (
    <LoginScreenView
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      errorMessage={errorMessage}
      handleLogin={handleLogin}
      navigation={navigation}
    />
  );
};

export default LoginScreen;