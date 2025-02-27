import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Alert
} from "react-native";
import { ref, onValue, remove } from "firebase/database";
import { database } from "../constants/firebaseconfig.js";
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AlertLogs({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all", "temperature", "fall"
  const [groupedAlerts, setGroupedAlerts] = useState({});
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const alertsRef = ref(database, "alerts/");
    setLoading(true);

    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const value = snapshot.val();
      setLoading(false);

      if (value) {
        const alertList = Object.entries(value).map(([id, alert]) => ({
          id,
          ...alert,
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setAlerts(alertList);
        
        // Group alerts by date
        const grouped = {};
        alertList.forEach(alert => {
          const date = new Date(alert.timestamp).toLocaleDateString();
          if (!grouped[date]) {
            grouped[date] = [];
          }
          grouped[date].push(alert);
        });
        
        setGroupedAlerts(grouped);
      } else {
        setAlerts([]);
        setGroupedAlerts({});
      }
    });

    return () => unsubscribe();
  }, []);

  function clearAlertHistory() {
    Alert.alert(
      "Clear Alert History",
      "Are you sure you want to delete all alerts?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear All",
          onPress: () => {
            remove(ref(database, "alerts/"));
            setAlerts([]);
            setGroupedAlerts({});
          },
          style: "destructive"
        }
      ]
    );
  }

  function getFilteredAlerts() {
    if (filter === "all") return alerts;
    return alerts.filter(alert => alert.type.toLowerCase() === filter);
  }

  function getFilteredGroupedAlerts() {
    if (filter === "all") return groupedAlerts;
    
    const filtered = {};
    Object.keys(groupedAlerts).forEach(date => {
      const filteredDateAlerts = groupedAlerts[date].filter(
        alert => alert.type.toLowerCase() === filter
      );
      if (filteredDateAlerts.length > 0) {
        filtered[date] = filteredDateAlerts;
      }
    });
    return filtered;
  }

  function getAlertIcon(type) {
    if (type.toLowerCase() === "temperature") {
      return <MaterialCommunityIcons name="thermometer-alert" size={24} color="#FF5252" />;
    } else if (type.toLowerCase() === "fall") {
      return <FontAwesome5 name="person-falling" size={24} color="#FF5252" />;
    }
    return <MaterialCommunityIcons name="alert-circle" size={24} color="#FF5252" />;
  }

  function getAlertBorderColor(type) {
    if (type.toLowerCase() === "temperature") {
      return "#FF9800";
    } else if (type.toLowerCase() === "fall") {
      return "#FF5252";
    }
    return "#7C4DFF";
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  const filteredGroupedAlerts = getFilteredGroupedAlerts();
  const groupDates = Object.keys(filteredGroupedAlerts).sort((a, b) => 
    new Date(b) - new Date(a)
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Alert History</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterTab, 
            filter === "all" && styles.activeFilterTab
          ]}
          onPress={() => setFilter("all")}
        >
          <Text style={[
            styles.filterText,
            filter === "all" && styles.activeFilterText
          ]}>All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterTab, 
            filter === "temperature" && styles.activeFilterTab
          ]}
          onPress={() => setFilter("temperature")}
        >
          <MaterialCommunityIcons 
            name="thermometer" 
            size={18} 
            color={filter === "temperature" ? "#FFFFFF" : "#AAAAAA"} 
          />
          <Text style={[
            styles.filterText,
            filter === "temperature" && styles.activeFilterText
          ]}>Temperature</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterTab, 
            filter === "fall" && styles.activeFilterTab
          ]}
          onPress={() => setFilter("fall")}
        >
          <FontAwesome5 
            name="person-falling" 
            size={16} 
            color={filter === "fall" ? "#FFFFFF" : "#AAAAAA"} 
          />
          <Text style={[
            styles.filterText,
            filter === "fall" && styles.activeFilterText
          ]}>Falls</Text>
        </TouchableOpacity>
      </View>

      {/* Alert List */}
      {alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-off" size={60} color="#AAAAAA" />
          <Text style={styles.emptyText}>No alerts recorded</Text>
        </View>
      ) : groupDates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-sleep" size={60} color="#AAAAAA" />
          <Text style={styles.emptyText}>No {filter} alerts found</Text>
          <TouchableOpacity
            style={styles.resetFilterButton}
            onPress={() => setFilter("all")}
          >
            <Text style={styles.resetFilterText}>Show All Alerts</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groupDates}
          keyExtractor={(date) => date}
          renderItem={({ item: date }) => (
            <View style={styles.dateSection}>
              <Text style={styles.dateHeader}>{date}</Text>
              {filteredGroupedAlerts[date].map(alert => (
                <View 
                  key={alert.id}
                  style={[
                    styles.alertCard, 
                    { borderLeftColor: getAlertBorderColor(alert.type) }
                  ]}
                >
                  <View style={styles.alertIconContainer}>
                    {getAlertIcon(alert.type)}
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>
                      {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Alert
                    </Text>
                    <Text style={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.alertDescription}>
                      {alert.message || `A ${alert.type.toLowerCase()} alert was triggered.`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={clearAlertHistory}
            >
              <Text style={styles.clearButtonText}>Clear Alert History</Text>
            </TouchableOpacity>
          }
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6200EE",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6200EE",
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
  },
  activeFilterTab: {
    backgroundColor: "#6200EE",
  },
  filterText: {
    fontSize: 14,
    color: "#666666",
    marginLeft: 5,
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666666",
    marginTop: 10,
    textAlign: "center",
  },
  resetFilterButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#6200EE",
    borderRadius: 25,
  },
  resetFilterText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  dateSection: {
    marginBottom: 15,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: "bold",
    backgroundColor: "#EEEEEE",
    padding: 10,
    marginBottom: 5,
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 15,
    elevation: 2,
    borderLeftWidth: 4,
  },
  alertIconContainer: {
    marginRight: 15,
    justifyContent: "center",
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333333",
  },
  alertTime: {
    fontSize: 14,
    color: "#888888",
    marginTop: 2,
  },
  alertDescription: {
    fontSize: 14,
    color: "#555555",
    marginTop: 5,
  },
  clearButton: {
    marginVertical: 20,
    marginHorizontal: 15,
    backgroundColor: "#FF5252",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});