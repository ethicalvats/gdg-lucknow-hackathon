# 📚 अवधी AI Physics Tutor

An interactive, vernacular voice-to-voice AI physics tutor for UP Board students, speaking in the local Lucknowi Awadhi dialect and rendering live blackboard simulations on-demand.

---

## 👥 Team & Project Details
* **Team Owner**: `@ethicalvats` (GitHub)
* **Project Title**: **अवधी AI Physics Tutor**
* **Short Description**: Awadhi AI Physics Tutor is a low-latency, voice-to-voice educational assistant designed for UP Board students, speaking entirely in the local Awadhi dialect. Leveraging the Gemini Multimodal Live API over WebSockets, the tutor provides real-time verbal explanations alongside dynamic, on-demand physics animations rendered on an interactive blackboard. This allows students to ask conceptual doubts verbally and instantly visualize abstract phenomena like forces, gravity, or inertia with interactive controls.

---

## 💡 Problem Statement
Quality educational tools and advanced AI tutors are overwhelmingly English-centric (or limited to formal Hindi), creating a significant learning barrier for vernacular state-board students in Uttar Pradesh. This project bridges the accessibility gap by combining real-time local dialect synthesis (Awadhi) with immediate, interactive visual feedback, allowing students to learn complex physics concepts in their native spoken tongue.

---

## 🛠️ Tech Stack & Tools
* **Frontend**: React 19, Vite, Vanilla CSS (Premium Glassmorphism Dark-Space Theme)
* **Audio Pipeline**: Web Audio API (PCM 16kHz Microphone Recorder, PCM 24kHz Queue-based Audio Player with immediate voice barge-in/interruption support)
* **WebSocket Channel**: Gemini Multimodal Live API WebSocket (`wss://`)
* **AI Model Engine**: `models/gemini-3.1-flash-live-preview` (supporting bidirectional live streaming and tool calling)
* **Development Server Logs Writer**: Custom Node/Vite middleware endpoint (`/api/save-logs`) for writing debug logs to local disk files
* **Design & Icons**: SVG vector graphics and custom pure CSS animations

---

## 🚀 Setup & Execution Instructions

### Prerequisites
* **Node.js**: Version 18 or above
* **npm**: Version 9 or above
* **Gemini API Key**: Obtain a key from Google AI Studio.

### Steps to Run
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ethicalvats/<repo-name>.git
   cd lucknow-gdg-hack
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Access the App**:
   Open [http://localhost:5173](http://localhost:5173) in your web browser.

5. **Begin Tutoring**:
   * Paste your **Gemini API Key** in the settings input and click **Connect**.
   * Toggle the microphone button to start speaking in Awadhi (e.g. *"भैया, Newton's first law of motion का होत है? समझाओ।"*) or type your question in the text chat box.
   * View the live visual simulator render on the blackboard, adjust parameters via sliders, and inspect the raw transactions by opening the **Debug Console** at the bottom.

---

## ⚠️ Known Limitations & Incomplete Features
* **Browser Sandbox Restrictions**: The visual blackboard is isolated using `sandbox="allow-scripts"`. Any script crash inside the AI-generated visual executes securely in its own scope and does not crash the host app, but it will print stack traces to the browser console.
* **Dialect Drift**: Since Gemini models are trained broadly, the model may occasionally slip from Lucknowi Awadhi into standard Hindi when expressing extremely complex English terminology (e.g., "Coefficient of Friction").
* **Local Logs Storage**: The automatic local file-writing server-side endpoint works exclusively when running the local Vite server (`npm run dev`) and is bypassed during static production deployments in favor of direct browser JSON downloads.
