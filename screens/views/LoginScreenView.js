import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import styles from "../styles/LoginScreenStyle";
import GradientBackground from "../components/GradientBackground";
import AnimatedEntrance from "../components/AnimatedEntrance";

export default function LoginScreenView({
  email,
  setEmail,
  password,
  setPassword,
  errorMessage,
  handleLogin,
  navigation,
}) {
  return (
    <GradientBackground>
      <View style={styles.container}>
        <AnimatedEntrance delay={40}>
          <View style={styles.panel}>
          <Text style={styles.title}>Iniciar Sesión</Text>
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <AnimatedEntrance delay={140}>
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          <AnimatedEntrance delay={200}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                ¿No tienes cuenta? Regístrate
              </Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          </View>
        </AnimatedEntrance>
      </View>
    </GradientBackground>
  );
}