import cv2
import mediapipe as mp
import numpy as np
from deepface import DeepFace
from collections import deque, Counter
from flask import Flask, Response, jsonify
import threading
import atexit
import time

# Initialize Flask app
app = Flask(__name__)

# Initialize MediaPipe FaceMesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False, 
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5)

emotion_history = deque(maxlen=50)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Error: Cannot open webcam")

dominant_emotion = "Neutral"
running = True
frame_skip = 5  # Only analyze every 5th frame to reduce CPU load
frame_count = 0

def detect_emotions():
    global dominant_emotion, running, frame_count
    
    while running:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue
            
        frame_count += 1
        if frame_count % frame_skip != 0:
            continue
            
        # Convert frame to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
            try:
                for face_landmarks in results.multi_face_landmarks:
                    height, width, _ = frame.shape
                    x_min = width
                    y_min = height
                    x_max = y_max = 0

                    for landmark in face_landmarks.landmark:
                        x, y = int(landmark.x * width), int(landmark.y * height)
                        x_min = min(x, x_min)
                        y_min = min(y, y_min)
                        x_max = max(x, x_max)
                        y_max = max(y, y_max)

                    # Add padding and ensure within frame bounds
                    padding = 20
                    x_min = max(0, x_min - padding)
                    y_min = max(0, y_min - padding)
                    x_max = min(width, x_max + padding)
                    y_max = min(height, y_max + padding)

                    face_roi = frame[y_min:y_max, x_min:x_max]

                    if face_roi.size > 0 and face_roi.shape[0] > 0 and face_roi.shape[1] > 0:
                        result = DeepFace.analyze(face_roi, actions=['emotion'], enforce_detection=False)
                        emotion = result[0]['dominant_emotion']

                        emotion_history.append(emotion)
                        emotion_counts = Counter(emotion_history)
                        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
                        print(f"Current emotion: {dominant_emotion}")
            except Exception as e:
                print(f"Error in emotion detection: {e}")
                continue

def generate_frames():
    while running:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.1)
            continue

        # Add text showing current emotion
        cv2.putText(frame, f"Mood: {dominant_emotion}", (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/mood', methods=['GET'])
def get_mood():
    return jsonify({"mood": dominant_emotion})

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def cleanup():
    global running
    running = False
    time.sleep(1)  # Give threads time to finish
    
    # Release webcam
    if cap is not None and cap.isOpened():
        cap.release()
    
    # Release MediaPipe resources
    face_mesh.close()
    
    print("Resources cleaned up")

# Register cleanup function
atexit.register(cleanup)

if __name__ == '__main__':
    # Get your actual IP - don't hardcode it
    import socket
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    print(f"Starting server on 172.17.31.187:5000")
    
    # Start emotion detection thread
    emotion_thread = threading.Thread(target=detect_emotions, daemon=True)
    emotion_thread.start()
    
    # Run Flask app
    app.run(host='172.17.31.187', port=5000, debug=False, threaded=True)