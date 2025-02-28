import React, { useState, useEffect } from "react";
import { View, StyleSheet, Text, Alert, Platform } from "react-native";
import { WebView } from "react-native-webview";
import * as Notifications from 'expo-notifications';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function LiveStream() {
  const [mood, setMood] = useState('Unknown');
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  
  // Request notification permissions
  useEffect(() => {
    async function requestPermissions() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Push notifications need to be enabled to alert you when someone appears sad.');
      }
    }
    
    requestPermissions();
  }, []);

  // Function to send notification
  async function sendSadMoodNotification() {
    // Prevent notification spam - limit to one notification every 30 seconds
    const now = Date.now();
    if (now - lastNotificationTime < 30000) return;
    
    setLastNotificationTime(now);
    
    
    
    // Also show in-app alert for immediate awareness
    Alert.alert(
      "Mood Alert",
      "Someone on camera appears to be sad or in pain",
      [{ text: "OK" }]
    );
  }

  // Fetch mood data regularly
  useEffect(() => {
    const fetchMood = async () => {
      try {
        const response = await fetch('http://172.17.31.187:5000/mood');
        const data = await response.json();
        const newMood = data.mood;
        
        setMood(newMood);
        
        // Check if mood is sad or indicates pain
        if (newMood.toLowerCase() === 'sad' || newMood.toLowerCase() === 'fear') {
          sendSadMoodNotification();
        }
      } catch (error) {
        console.error('Error fetching mood:', error);
      }
    };

    // Update mood every second
    fetchMood(); // Initial fetch
    const interval = setInterval(fetchMood, 1000);
    return () => clearInterval(interval);
  }, [lastNotificationTime]);

  // Get color based on mood
  const getMoodColor = (currentMood) => {
    const colors = {
      'happy': '#FFC107', // Yellow
      'sad': '#F44336',   // Red (changed to make sad more alarming)
      'angry': '#FF5722', // Deep Orange
      'fear': '#9C27B0',  // Purple
      'surprise': '#FF9800', // Orange
      'disgust': '#4CAF50', // Green
      'neutral': '#9E9E9E', // Gray
    };
    
    return colors[currentMood.toLowerCase()] || '#9E9E9E';
  };

  return (
    <View style={styles.container}>
      <WebView 
        source={{ uri: "http://172.17.31.187:5000/video_feed" }} 
        style={styles.webView}
        allowsInlineMediaPlayback={true} 
        mediaPlaybackRequiresUserAction={false}
      />
      <View style={[
        styles.moodContainer, 
        { backgroundColor: getMoodColor(mood) }
      ]}>
        <Text style={styles.moodText}>
          Current Mood: {mood}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    position: 'relative'
  },
  webView: { 
    flex: 1, 
    width: "100%", 
    height: "100%" 
  },
  moodContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  moodText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  }
});