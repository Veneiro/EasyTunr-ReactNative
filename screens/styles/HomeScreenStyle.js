import { StyleSheet } from "react-native";

const PRIMARY = "#6C63FF";
const ACCENT = "#FF6584";
const BG = "#F5F6FA";
const DARK = "#232946";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    minHeight: "100vh",
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: DARK,
    marginBottom: 32,
    textAlign: "center",
    opacity: 0.8,
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: "center",
    marginBottom: 18,
    width: "90%",
    minWidth: 200,
    elevation: 2,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 0.5,
  },
});