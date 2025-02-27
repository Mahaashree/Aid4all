import React, { useState, useEffect, useRef } from "react";
import { 
  View, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  Alert, 
  TouchableOpacity,
  Animated,
  Easing,
  Image,
  ScrollView
} from "react-native";
import { getDatabase, ref, onValue, push, set } from "firebase/database";
import { firebaseApp } from "../constants/firebaseconfig";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const database = getDatabase(firebaseApp);
let fallAlarmSound = null; // Global sound instance

export default function SensorData({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fallAlertRef = useRef(false);
  const tempAlertRef = useRef(false);
  
  // Animation values
  const fallPulse = useRef(new Animated.Value(1)).current;
  const temperatureScale = useRef(new Animated.Value(0)).current;
  const humidityOpacity = useRef(new Animated.Value(0)).current;

  // Start pulsing animation for fall detection
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fallPulse, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(fallPulse, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  };

  // Animate temperature and humidity indicators when data changes
  useEffect(() => {
    if (data) {
      Animated.parallel([
        Animated.timing(temperatureScale, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.elastic(1),
        }),
        Animated.timing(humidityOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [data]);

  useEffect(() => {
    const sensorRef = ref(database, "house/");
    setLoading(true);

    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        setData(value);
        setLoading(false);
      }

      // Fall detection alert logic
      if (value?.fall_detection === true && !fallAlertRef.current) {
        fallAlertRef.current = true;
        sendFallAlert();
        startPulseAnimation();
      } else if (value?.fall_detection === false && fallAlertRef.current) {
        fallAlertRef.current = false;
        stopAlarmSound();
        fallPulse.setValue(1); // Reset animation
      }

      // Temperature alert logic
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

  function getComfortColor(level) {
    switch (level) {
      case "Very Humid & Hot": return ["#FF5733", "#FF8C42"];
      case "Comfortable": return ["#52c234", "#061700"];
      case "Cold & Dry": return ["#2193b0", "#6dd5ed"];
      default: return ["#4286f4", "#373B44"];
    }
  }

  function getTemperatureColor(temp) {
    if (temp > 30) return ["#FF416C", "#FF4B2B"];
    if (temp >= 20) return ["#FF8008", "#FFC837"];
    if (temp >= 10) return ["#4286f4", "#373B44"];
    return ["#2193b0", "#6dd5ed"];
  }

  function logAlert(type, message) {
    const alertsRef = ref(database, "alerts/");
    const newAlertRef = push(alertsRef);
    set(newAlertRef, {
      type: type,
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
    Alert.alert(
      "🚨 Fall Detected!", 
      "A fall has been detected. Please check immediately!", 
      [{ text: "OK", onPress: stopAlarmSound }]
    );
  }

  async function playAlarmSound() {
    if (fallAlarmSound) return;
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
      fallAlarmSound = null;
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
  
  // Calculate temperature gauge position (0-100%)
  const getTemperatureGaugePosition = (temp) => {
    const min = -10; // Minimum temperature
    const max = 50;  // Maximum temperature
    const percentage = ((temp - min) / (max - min)) * 100;
    return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100%
  };

  // Calculate humidity gauge position (0-100%)
  const getHumidityGaugePosition = (humidity) => {
    return Math.min(Math.max(humidity, 0), 100); // Clamp between 0-100%
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={styles.loadingText}>Connecting to sensors...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="connection-off" size={60} color="#FF5252" />
        <Text style={styles.errorText}>Cannot connect to sensors</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setLoading(true)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const comfortLevel = getComfortLevel(data.temp, data.humidity);
  const comfortColors = getComfortColor(comfortLevel);
  const tempColors = getTemperatureColor(data.temp);
  const tempGaugePosition = getTemperatureGaugePosition(data.temp);
  const humidityGaugePosition = getHumidityGaugePosition(data.humidity);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aid4All</Text>
        <Text style={styles.headerSubtitle}>Real-time care taker</Text>
      </View>

      {/* Temperature Card */}
      <Animated.View 
        style={[
          styles.card, 
          {transform: [{scale: temperatureScale}]}
        ]}
      >
        <LinearGradient
          colors={tempColors}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="thermometer" size={28} color="white" />
            <Text style={styles.cardTitle}>Temperature</Text>
          </View>

          <View style={styles.temperatureContainer}>
            <Text style={styles.temperatureValue}>{data.temp}°C</Text>
            
            <View style={styles.temperatureGauge}>
              <View style={styles.temperatureGaugeBackground}>
                <View 
                  style={[
                    styles.temperatureGaugeFill, 
                    {width: `${tempGaugePosition}%`}
                  ]} 
                />
              </View>
              <View style={styles.temperatureGaugeLabels}>
                <Text style={styles.gaugeLabel}>-10°C</Text>
                <Text style={styles.gaugeLabel}>20°C</Text>
                <Text style={styles.gaugeLabel}>50°C</Text>
              </View>
            </View>

            {(data.temp > 40 || data.temp < 5) && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>
                  {data.temp > 40 ? "High Temperature!" : "Low Temperature!"}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Humidity Card */}
      <Animated.View 
        style={[
          styles.card, 
          {opacity: humidityOpacity}
        ]}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="water-percent" size={28} color="#5C6BC0" />
            <Text style={[styles.cardTitle, {color: "#5C6BC0"}]}>Humidity</Text>
          </View>
          
          <View style={styles.humidityContainer}>
            <Text style={[styles.humidityValue, {color: "#5C6BC0"}]}>{data.humidity}%</Text>
            
            <View style={styles.humidityGauge}>
              <View style={styles.humidityGaugeBackground}>
                <View 
                  style={[
                    styles.humidityGaugeFill, 
                    {width: `${humidityGaugePosition}%`, backgroundColor: "#5C6BC0"}
                  ]} 
                />
              </View>
              <View style={styles.humidityGaugeLabels}>
                <Text style={[styles.gaugeLabel, {color: "#5C6BC0"}]}>0%</Text>
                <Text style={[styles.gaugeLabel, {color: "#5C6BC0"}]}>50%</Text>
                <Text style={[styles.gaugeLabel, {color: "#5C6BC0"}]}>100%</Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Comfort Level Card */}
      <View style={styles.card}>
        <LinearGradient
          colors={comfortColors}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="home-thermometer" size={28} color="white" />
            <Text style={styles.cardTitle}>Comfort Level</Text>
          </View>
          
          <View style={styles.comfortContainer}>
            <Text style={styles.comfortValue}>{comfortLevel}</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Fall Detection Card */}
      <Animated.View 
        style={[
          styles.card, 
          styles.fallCard,
          {transform: [{ scale: data.fall_detection ? fallPulse : 1 }]}
        ]}
      >
        <LinearGradient
          colors={data.fall_detection ? ["#FF416C", "#FF4B2B"] : ["#1D976C", "#93F9B9"]}
          style={styles.cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <FontAwesome5 
              name={data.fall_detection ? "person-falling" : "person-walking"} 
              size={28} 
              color="white" 
            />
            <Text style={styles.cardTitle}>Fall Detection</Text>
          </View>
          
          <View style={styles.fallDetectionContainer}>
            <Text style={styles.fallDetectionStatus}>
              {data.fall_detection ? "🚨 Fall Detected! 🚨" : "✅ No Fall Detected"}
            </Text>
            
            {data.fall_detection && (
              <Text style={styles.fallWarning}>
                Please check immediately!
              </Text>
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => navigation.navigate("AlertLogs")}
        >
          <LinearGradient
            colors={["#4F80E1", "#304FFE"]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <MaterialCommunityIcons name="history" size={24} color="white" />
            <Text style={styles.buttonText}>View Alert History</Text>
          </LinearGradient>
        </TouchableOpacity>

        
      </View>

      {/* Emergency Contact Button */}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
    padding: 20,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 10,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 30,
    backgroundColor: "#6200EE",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    marginBottom:20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#AAAAAA",
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fallCard: {
    borderWidth: 2,
    borderColor: "#FF4B2B",
  },
  cardGradient: {
    padding: 20,
  },
  cardContent: {
    padding: 20,
    backgroundColor: "#1E1E1E",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  temperatureContainer: {
    alignItems: "center",
  },
  temperatureValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  temperatureGauge: {
    width: "100%",
    marginTop: 8,
  },
  temperatureGaugeBackground: {
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 8,
    overflow: "hidden",
  },
  temperatureGaugeFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
  },
  temperatureGaugeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  gaugeLabel: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  alertBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
  },
  alertBadgeText: {
    color: "#FF4B2B",
    fontWeight: "bold",
  },
  humidityContainer: {
    alignItems: "center",
    
  },
  humidityValue: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 16,
  },
  humidityGauge: {
    width: "100%",
    marginTop: 8,
  },
  humidityGaugeBackground: {
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    overflow: "hidden",
  },
  humidityGaugeFill: {
    height: "100%",
    borderRadius: 8,
  },
  humidityGaugeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  comfortContainer: {
    alignItems: "center",
  },
  comfortValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  fallDetectionContainer: {
    alignItems: "center",
  },
  fallDetectionStatus: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  fallWarning: {
    fontSize: 18,
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  historyButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
  },
  dismissButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emergencyButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
    marginTop: 8,
    marginBottom: 24,
  },
  emergencyButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
});