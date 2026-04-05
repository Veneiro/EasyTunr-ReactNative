import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import styles from "../styles/RegisterScreenStyle";
import GradientBackground from "../components/GradientBackground";
import AnimatedEntrance from "../components/AnimatedEntrance";

export default function RegisterScreenView({
  email,
  setEmail,
  password,
  setPassword,
  handleRegister,
  navigation,
}) {
  return (
    <GradientBackground>
      <View style={styles.container}>
        <AnimatedEntrance delay={40}>
          <View style={styles.panel}>
          <Text style={styles.title}>Crear Cuenta</Text>
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
            onSubmitEditing={handleRegister}
          />
          <AnimatedEntrance delay={140}>
            <TouchableOpacity style={styles.button} onPress={handleRegister}>
              <Text style={styles.buttonText}>Registrarse</Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          <AnimatedEntrance delay={200}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                ¿Ya tienes cuenta? Inicia sesión
              </Text>
            </TouchableOpacity>
          </AnimatedEntrance>
          </View>
        </AnimatedEntrance>
      </View>
    </GradientBackground>
  );
}