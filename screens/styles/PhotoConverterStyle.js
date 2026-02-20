import { StyleSheet } from "react-native";

const PRIMARY = "#6C63FF";
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
    fontSize: 28,
    fontWeight: "bold",
    color: PRIMARY,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
    gap: 12,
    flexWrap: "wrap",
    width: "100%",
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 30,
    marginHorizontal: 6,
    minWidth: 120,
    alignItems: "center",
    elevation: 2,
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  image: {
    width: "100%",
    maxWidth: 200,
    height: 200,
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRIMARY,
    objectFit: "cover",
  },
});