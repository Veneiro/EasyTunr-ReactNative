import { StyleSheet } from "react-native";

const PRIMARY = "#6C63FF";
const ACCENT = "#FF6584";
const BG = "#F5F6FA";
const DARK = "#232946";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: PRIMARY,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: DARK,
    marginBottom: 24,
    textAlign: "center",
    opacity: 0.8,
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
  buttonActive: {
    backgroundColor: ACCENT,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  convertButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: "center",
    marginBottom: 24,
    elevation: 3,
    width: "90%",
    minWidth: 200,
  },
  convertButtonDisabled: {
    backgroundColor: "#bbb",
  },
  convertButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    letterSpacing: 1,
  },
  fileInfo: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    width: "100%",
    maxWidth: 400,
  },
  fileLabel: {
    color: DARK,
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 4,
  },
  fileName: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "bold",
    wordBreak: "break-word",
    textAlign: "center",
  },
});