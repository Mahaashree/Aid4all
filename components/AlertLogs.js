import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { ref, onValue, remove } from "firebase/database";
import { database } from "../constants/firebaseconfig.js"; // Update the path if needed

export default function AlertLogs({ navigation }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const alertsRef = ref(database, "alerts/");
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        const alertList = Object.values(value).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAlerts(alertList);
      }
    });

    return () => unsubscribe();
  }, []);

  function clearAlertHistory() {
    remove(ref(database, "alerts/"));
    setAlerts([]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚨 Alert History</Text>

      {alerts.length === 0 ? (
        <Text style={styles.noAlerts}>No alerts recorded</Text>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.alertItem}>
              <Text style={styles.alertType}>🔹 {item.type} Alert</Text>
              <Text>{item.message}</Text>
              <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.clearButton} onPress={clearAlertHistory}>
        <Text style={styles.clearButtonText}>Clear History</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>🔙 Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8f8f8" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  noAlerts: { textAlign: "center", marginTop: 20, fontSize: 16 },
  alertItem: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  alertType: { fontWeight: "bold", color: "#d9534f" },
  timestamp: { fontSize: 12, color: "#888" },
  clearButton: { marginTop: 20, padding: 10, backgroundColor: "red", borderRadius: 5, alignItems: "center" },
  clearButtonText: { color: "#fff", fontWeight: "bold" },
  backButton: { marginTop: 10, padding: 10, backgroundColor: "#007bff", borderRadius: 5, alignItems: "center" },
  backButtonText: { color: "#fff", fontWeight: "bold" },
});
