import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert, TouchableOpacity, navigation} from "react-native";
import { getDatabase, ref, onValue, push, set } from "firebase/database";
import { firebaseApp } from "../constants/firebaseconfig";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";

const database = getDatabase(firebaseApp);
let fallAlarmSound = null; // Global sound instance

export default function SensorData({navigation}) {
  const [data, setData] = useState(null);
  const fallAlertRef = useRef(false); // Use ref to track fall alert state
  const tempAlertRef = useRef(false); // Use ref to track temp alert state

  useEffect(() => {
    const sensorRef = ref(database, "house/");

    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setData(value);
      }

      // Fall detection alert logic
      if (value?.fall_detection === true && !fallAlertRef.current) {
        fallAlertRef.current = true;
        sendFallAlert();
      } else if (value?.fall_detection === false && fallAlertRef.current) {
        fallAlertRef.current = false;
        stopAlarmSound();
      }

      // Temperature alert logic
      // Temperature alert logic - Always check and send alerts
      if (value?.temp > 40 || value?.temp < 5) {
        sendTempAlert(value.temp);
      }


    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.warn("Permission for notifications not granted!");
      }
    }
    requestPermissions();
  }, []);

  function getComfortLevel(temp, humidity) {
    if (temp > 30 && humidity > 70) return "Very Humid & Hot";
    if (temp >= 20 && temp <= 25 && humidity >= 40 && humidity <= 60)
      return "Comfortable";
    if (temp < 15 && humidity < 40) return "Cold & Dry";
    return "Moderate";
  }

  

  function logAlert(type, message) {
    const alertsRef = ref(database, "alerts/"); // Firebase path for alerts

    const newAlertRef = push(alertsRef); // Create a new alert entry
    set(newAlertRef, {
      type: type, // "Temperature" or "Fall"
      message: message,
      timestamp: new Date().toISOString(),
    });
  }


  async function sendTempAlert(temp) {
    const message = temp > 40 ? "High Temperature!" : "Low Temperature!";
    logAlert("Temperature", `Current temp: ${temp}°C - ${message}`);
    sendNotification("⚠️ Temperature Alert!", `Current temp: ${temp}°C - ${message}`);
    Alert.alert("⚠️ Temperature Alert!", `Current temp: ${temp}°C - ${message}`);
  }
  
  async function sendFallAlert() {
    await playAlarmSound();
    sendNotification("🚨 Fall Detected!", "A fall has been detected. Please check immediately!");
    logAlert("Fall", "A fall has been detected. Please check immediately!");
    Alert.alert("🚨 Fall Detected!", "A fall has been detected. Please check immediately!", [
      { text: "OK", onPress: stopAlarmSound },
    ]);
  }

  async function playAlarmSound() {
    if (fallAlarmSound) return; // Don't play again if already playing
  
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/eas-alarm-phone-alarm-262882.mp3"),
      { shouldPlay: true, isLooping: true }
    );
  
    fallAlarmSound = sound;
    await fallAlarmSound.playAsync();
  }
  
  async function stopAlarmSound() {
    if (fallAlarmSound) {
      await fallAlarmSound.stopAsync();
      await fallAlarmSound.unloadAsync();
      fallAlarmSound = null; // Clear reference
    }
  }

  async function sendNotification(title, body) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: "default",
      },
      trigger: { seconds: 1 },
    });
  }
  
  if (!data) return <ActivityIndicator size="large" color="blue" />;

  return (
    <View style={styles.container}>
      <Text style={styles.text}> Temperature: {data.temp}°C</Text>
      <Text style={styles.text}> Humidity: {data.humidity}%</Text>
      <Text style={[styles.text, { fontSize: 20, color: "#ff4500" }]}>
        Comfort Level: {getComfortLevel(data.temp, data.humidity)}
      </Text>
      <Text style={styles.alert}>
        {data.fall_detection ? "🚨 Fall Detected! 🚨" : "✅ No Fall Detected"}
      </Text>
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation.navigate("AlertLogs")}
      >
        <Text style={[styles.text, { fontSize: 20, color: "#ff4500" }]}>📜 View Alert History</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#ff4500",
  },
  alert: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    color: "red",
  },
});
