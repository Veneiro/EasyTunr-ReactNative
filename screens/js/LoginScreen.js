import React, { useState } from "react";
import LoginScreenView from "../views/LoginScreenView";
import { apiUrl } from "../../lib/api";
import { saveAuthSession } from "../../lib/authSession";

const LoginScreen = ({ navigation, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    try {
      const response = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        await saveAuthSession(data.token, data.token_expires_in_seconds || 600);
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