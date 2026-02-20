import React, { useState } from "react";
import RegisterScreenView from "../views/RegisterScreenView";

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const response = await fetch("http://192.168.1.13:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        navigation.navigate("Login");
      } else {
        alert(data.message || "No se pudo registrar");
      }
    } catch (error) {
      alert("Hubo un problema al registrar.");
    }
  };

  return (
    <RegisterScreenView
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      handleRegister={handleRegister}
      navigation={navigation}
    />
  );
};

export default RegisterScreen;