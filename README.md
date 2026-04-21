# 🏥 MediTrack Malaysia

**MediTrack Malaysia** is a state-of-the-art, real-time hospital vacancy and ambulance tracking application designed to streamline emergency medical responses across Malaysia. Using a combination of live mapping, road-following routing logic, and AI-powered medical assistance, it connects patients with help faster than ever.
Hosted at: [Link to the hosted webApp](https://hospital-tracker-937921025720.asia-southeast1.run.app/)

---

## 🚀 Key Features

### 🗺️ Live Hospital Mapping
- **Real-Time Status**: View 20+ major hospitals in Malaysia (public and private) with live bed availability and ER status updates.
- **Dynamic Indicators**: Visual color-coded markers (Open, Limited, Full) help you identify the best facility at a glance.
- **Detailed Insights**: Tap any hospital to see full address, contact details, and distance from your current location.

### 🚑 Intelligent Ambulance Dispatch
- **Closest Unit Logic**: Automatically identifies and dispatches the nearest available ambulance to your GPS coordinates.
- **Realistic Road Routing**: Powered by **OSRM (Open Source Routing Machine)**, the ambulance follows actual road geometries and turns, rather than simple straight lines.
- **Precise ETAs**: Real-world driving durations are calculated dynamically to give you an accurate arrival time down to the second.
- **Dual-Phase Tracking**: Track the ambulance coming to you, and then track your journey from your pickup point to the chosen destination hospital.

### 🤖 Gemini AI Medical Assistant
- **Expert Guidance**: Integrated **Gemini AI Chatbot** (using `gemini-2.0-flash`) provides instant answers to medical questions and first-aid guidance.
- **Context Awareness**: The AI is aware of your current emergency status, location, and destination hospital to provide tailored support.

### 🏢 Multi-Role Dashboards
- **Patient Portal**: Call for help, track arrivals, and choose destination hospitals based on real-time capacity.
- **Hospital Dashboard**: Manage bed counts, update Emergency Room status, and monitor incoming patients.
- **Ambulance Driver View**: Receive dispatches, view road-optimal routes to patients, and update arrival statuses.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern dark-mode glassmorphism), JavaScript (ES6+).
- **Mapping**: [Leaflet.js](https://leafletjs.com/) with [CartoDB](https://carto.com/) dark-themed tile layers.
- **Routing Engine**: [OSRM API](http://project-osrm.org/) for legitimate road-path calculation.
- **Artificial Intelligence**: [Google Gemini API](https://ai.google.dev/) for the integrated medical assistant.
- **Deployment**: [Docker](https://www.docker.com/) & [Google Cloud Run](https://cloud.google.com/run) (Serverless NGINX).

---

## 📦 Getting Started

### Prerequisites
- Any modern web browser.
- (Optional) A Gemini API Key (stored in `js/data.js`).

### Running Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/mazecat2k/meditrack-malaysia.git
   ```
2. Open `index.html` in your browser.
3. Use the demo accounts (password: `demo123`):
   - **Patient**: `patient@demo.com`
   - **Hospital**: `hospital@demo.com`
   - **Driver**: `ambulance@demo.com`

### Deployment to Cloud Run
The project is container-ready with a `Dockerfile`.
```bash
gcloud run deploy hospital-tracker --source . --region asia-southeast1 --allow-unauthenticated
```

---

## 📂 Project Structure

- `index.html`: Main landing and authentication portal.
- `app.html`: Central dashboard framework.
- `js/`: Core application logic (Map, Auth, Chatbot, Dashboards).
- `css/`: Modern UI/UX styling.
- `Dockerfile`: Production deployment configuration.

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ for Malaysia's Emergency Services.*
