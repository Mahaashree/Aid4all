import cv2
import mediapipe as mp
import numpy as np
from deepface import DeepFace
from collections import deque, Counter
from flask import Flask, Response, jsonify
import threading

# Initialize Flask app
app = Flask(__name__)

# Initialize MediaPipe FaceMesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.5)

emotion_history = deque(maxlen=50)
cap = cv2.VideoCapture(1)  

if not cap.isOpened():
        print("❌ Error: Cannot open webcam")
        


dominant_emotion = "Neutral"

def detect_emotions():
    global dominant_emotion

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        # Convert frame to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)

        if results.multi_face_landmarks:
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

                face_roi = frame[y_min:y_max, x_min:x_max]

                if face_roi.size > 0:
                    try:
                        result = DeepFace.analyze(face_roi, actions=['emotion'], enforce_detection=False)
                        emotion = result[0]['dominant_emotion']

                        emotion_history.append(emotion)
                        emotion_counts = Counter(emotion_history)
                        dominant_emotion = max(emotion_counts, key=emotion_counts.get)
                    
                    except Exception as e:
                        print("Error:", e)

@app.route('/mood', methods=['GET'])
def get_mood():
    return jsonify({"mood": dominant_emotion})

def generate_frames():
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    threading.Thread(target=detect_emotions, daemon=True).start()
    app.run(host='172.17.18.238', port=5000, debug=False)
