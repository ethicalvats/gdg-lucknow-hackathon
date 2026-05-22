import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import VisualBoard from "./components/VisualBoard";
import { AudioRecorder } from "./utils/AudioRecorder";
import { AudioPlayer } from "./utils/AudioPlayer";

const sanitizeForLog = (obj) => {
  if (typeof obj === "string") {
    if (obj.length > 150) {
      return obj.substring(0, 80) + `... [truncated, length: ${obj.length}]`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }
  if (obj !== null && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = sanitizeForLog(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

export default function App() {
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("gemini_tutor_api_key") || ""
  );
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState([
    {
      sender: "tutor",
      text: "नमस्ते! हम तोहार अवधी AI Tutor अही। हमसे भौतिकी (Physics) या कौनो और विषय के बारे में पूछें, और हम तोहार संदेह दूर करब और blackboard पर चित्र बनाकर समझाइब।",
    },
  ]);
  const [visualCode, setVisualCode] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const debugLogsRef = useRef([]);
  useEffect(() => {
    debugLogsRef.current = debugLogs;
  }, [debugLogs]);

  const logDebug = (direction, type, data) => {
    const time = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    const sanitizedData = typeof data === "object" ? JSON.stringify(sanitizeForLog(data), null, 2) : String(data);
    setDebugLogs((prev) => [
      { id, time, direction, type, data: sanitizedData },
      ...prev,
    ].slice(0, 50));
  };

  const clearLogs = () => {
    setDebugLogs([]);
    setSaveStatus("");
  };

  const saveLogsToFile = async (logsToSave = debugLogsRef.current) => {
    if (logsToSave.length === 0) return;
    try {
      const response = await fetch("/api/save-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logsToSave, null, 2),
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.filepath.replace(/^.*[\\\/]/, '');
        setSaveStatus(`Logs auto-saved to /logs/${filename}`);
        setTimeout(() => setSaveStatus(""), 6000);
      } else {
        console.error("Failed to save logs to file:", result.error);
      }
    } catch (err) {
      console.error("Error saving logs:", err);
    }
  };

  const downloadLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(debugLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gemini_api_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const ws = useRef(null);
  const recorder = useRef(null);
  const player = useRef(null);
  const transcriptEndRef = useRef(null);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem("gemini_tutor_api_key", key);
  };

  const connectSession = () => {
    if (!apiKey) {
      setError("कृपया पहले अपनी Gemini API Key दर्ज करें।");
      return;
    }

    setConnecting(true);
    setError(null);

    // Initialize AudioPlayer
    player.current = new AudioPlayer();
    player.current.init();

    // Multimodal Live API WebSocket URL (v1beta)
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        console.log("WebSocket connected to Gemini Live API");

        // Send Setup message immediately
        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview", // standard Live API model
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede", // Options: Aoede, Puck, Charon, Kore, Fenrir
                  },
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: 
                    "You are a native Awadhi speaker and a tutor from Lucknow. " +
                    "Speak entirely in the Awadhi dialect using regional grammar, expressions, and tone. " +
                    "For example, use 'हमार' (hamaar), 'तोहार' (tohar), 'का हाल बा / का हाल अहै' (ka haal ba / ka haal ahai) and typical Awadhi structures. " +
                    "You explain complex physics concepts in a very helpful, friendly local accent. " +
                    "When explaining a concept (like Newton's laws of motion, force, friction, inertia, gravity), you MUST call the tool `explain_with_visuals` to render an interactive HTML5/Canvas/SVG physics simulation explaining the concept. " +
                    "Make sure the CSS and JS generated are complete and fully working inside the iframe. " +
                    "Keep your spoken explanations relatively short and punchy so the student doesn't have to wait, and let the blackboard do the heavy lifting. " +
                    "Be very warm and conversational."
                },
              ],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "explain_with_visuals",
                    description:
                      "Render a custom HTML/CSS/JS interactive visual simulation on the Blackboard to explain a concept in real-time.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        html: {
                          type: "STRING",
                          description:
                            "Complete HTML structure for the canvas or SVG visual. All custom styles should be in a self-contained <style> tag here. Design a container for any interactive sliders, value labels, or play/reset buttons.",
                        },
                        js: {
                          type: "STRING",
                          description:
                            "JavaScript animation logic and physics simulation. It should attach event listeners to control inputs (e.g. range sliders, restart buttons) and run a requestAnimationFrame loop to render physics updates. Do not use ES6 imports. Use plain browser JS APIs.",
                        },
                        title: {
                          type: "STRING",
                          description: "Concept Title in Hindi or Devanagari script.",
                        },
                      },
                      required: ["html", "js", "title"],
                    },
                  },
                ],
              },
            ],
          },
        };
        ws.current.send(JSON.stringify(setupMessage));
        logDebug("sent", "SETUP", setupMessage);
      };

      ws.current.onmessage = async (event) => {
        try {
          let text = event.data;
          if (event.data instanceof Blob) {
            text = await event.data.text();
          }
          const data = JSON.parse(text);
          let type = "SERVER_MESSAGE";
          if (data.toolCall) {
            type = "TOOL_CALL";
          } else if (data.serverContent?.interrupted) {
            type = "INTERRUPT";
          } else if (data.serverContent?.modelTurn?.parts) {
            type = "MODEL_TURN";
          } else if (data.serverContent?.turnComplete) {
            type = "TURN_COMPLETE";
          }
          logDebug("received", type, data);
          handleServerMessage(data);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          logDebug("error", "PARSE_ERROR", { error: err.message });
        }
      };

      ws.current.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket कनेक्शन में त्रुटि हुई। कृपया जांचें कि आपकी API key सही है या नहीं।");
        logDebug("error", "WS_ERROR", { message: "WebSocket connection error occurred" });
        disconnectSession();
      };

      ws.current.onclose = (event) => {
        console.log("WebSocket connection closed", event);
        logDebug("error", "WS_CLOSE", { code: event.code, reason: event.reason || "No reason provided" });
        disconnectSession();
      };
    } catch (err) {
      console.error("Error creating WebSocket:", err);
      setError(`कनेक्शन शुरू करने में विफल: ${err.message}`);
      setConnecting(false);
    }
  };

  const disconnectSession = () => {
    // Save session logs to disk file automatically on disconnect
    saveLogsToFile(debugLogsRef.current);

    // Stop recording
    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
    }
    setIsRecording(false);

    // Stop audio player
    if (player.current) {
      player.current.close();
      player.current = null;
    }

    // Close WebSocket
    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      ws.current = null;
    }

    setConnected(false);
    setConnecting(false);
  };

  const handleServerMessage = (data) => {
    // Handle interruption
    if (data.serverContent?.interrupted) {
      console.log("Model response interrupted by user talk");
      player.current?.stop();
      return;
    }

    // Handle tool calls at the root level (Gemini Live API protocol)
    if (data.toolCall) {
      const functionCalls = data.toolCall.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === "explain_with_visuals") {
            const args = call.args;
            console.log("Rendering dynamic blackboard simulation:", args.title);
            
            setVisualCode({
              html: args.html,
              js: args.js,
              title: args.title,
            });

            // Send tool call response back immediately to satisfy model state
            const responseMsg = {
              toolResponse: {
                functionResponses: [
                  {
                    name: "explain_with_visuals",
                    id: call.id,
                    response: {
                      output: {
                        status: "Simulation blackboard loaded successfully.",
                      },
                    },
                  },
                ],
              },
            };

            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify(responseMsg));
              logDebug("sent", "TOOL_RESPONSE", responseMsg);
            }
          }
        }
      }
    }

    const parts = data.serverContent?.modelTurn?.parts;
    if (parts) {
      let textChunk = "";

      for (const part of parts) {
        if (part.inlineData) {
          player.current?.playChunk(part.inlineData.data);
        }
        if (part.text) {
          textChunk += part.text;
        }
      }

      if (textChunk) {
        setTranscript((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === "tutor") {
            // Append to existing stream
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, text: lastMsg.text + textChunk },
            ];
          } else {
            // Start a new response turn
            return [...prev, { sender: "tutor", text: textChunk }];
          }
        });
      }
    }
  };

  const toggleRecording = async () => {
    if (!connected) return;

    if (isRecording) {
      // Stop recording
      if (recorder.current) {
        recorder.current.stop();
        recorder.current = null;
      }
      setIsRecording(false);
      setTranscript((prev) => [
        ...prev,
        { sender: "user", text: "🎤 (संदेह बोल दिया गया है - AI जवाब दे रहा है)" },
      ]);
    } else {
      // Start recording
      setError(null);
      
      // Stop any playing audio immediately (interruption)
      player.current?.stop();

      // Send interruption signal if model is currently speaking
      // (Gemini Live recognizes clientContent/realtimeInput as barge-in signals)
      
      recorder.current = new AudioRecorder((base64Audio) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          const micMessage = {
            realtimeInput: {
              audio: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio,
              },
            },
          };
          ws.current.send(JSON.stringify(micMessage));
        }
      });

      try {
        await recorder.current.start();
        setIsRecording(true);
      } catch (err) {
        setError(`माइक्रोफ़ोन एक्सेस करने में विफल: ${err.message}`);
        setIsRecording(false);
      }
    }
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!textInput.trim() || !connected) return;

    // Stop speaking immediately if student types something (barge-in)
    player.current?.stop();

    const userText = textInput.trim();
    setTranscript((prev) => [...prev, { sender: "user", text: userText }]);
    setTextInput("");

    // Send clientContent text turn
    const textMsg = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: userText }],
          },
        ],
        turnComplete: true,
      },
    };

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(textMsg));
      logDebug("sent", "TEXT_TURN", textMsg);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>📚 अवधी AI Physics Tutor</h1>
          <p>UP Board परीक्षा तैयारी — लाइव बातचीत और चित्र द्वारा सीखें</p>
        </div>
        <div className="status-badge">
          <div
            className={`status-dot ${
              connected ? "connected" : connecting ? "connecting" : ""
            }`}
          />
          {connected
            ? "लाइव कनेक्शन"
            : connecting
            ? "कनेक्ट हो रहा है..."
            : "डिस्कनेक्टेड"}
        </div>
      </header>

      {error && <div className="alert-error">⚠️ {error}</div>}

      <main className="main-grid">
        {/* Left Column: Tutor Hub */}
        <section className="glass-panel glow">
          <div className="panel-header">
            <h2>Aoede — ट्यूटर हब</h2>
          </div>

          <div className="panel-content">
            {/* Connection Settings */}
            {!connected ? (
              <div className="settings-group">
                <label>Gemini API Key</label>
                <input
                  type="password"
                  className="input-key"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                />
                <button
                  className="btn-connect"
                  onClick={connectSession}
                  disabled={connecting}
                >
                  {connecting ? "कनेक्ट हो रहा है..." : "ट्यूटर से जुड़ें (Live)"}
                </button>
              </div>
            ) : (
              <button
                className="btn-connect disconnect"
                onClick={disconnectSession}
              >
                ट्यूटर से अलग हों (Disconnect)
              </button>
            )}

            {/* Avatar Visualization */}
            <div className="avatar-container">
              <div className={`avatar-outer ${connected ? "active" : ""}`}>
                <div className="visualizer-rings" />
                <div
                  className={`avatar-core ${
                    isRecording
                      ? "recording"
                      : connected
                      ? "speaking"
                      : ""
                  }`}
                >
                  <div className="avatar-icon-glow" />
                  {/* Floating visual representation */}
                  <span style={{ fontSize: "2rem" }}>🪐</span>
                </div>
              </div>
              <span className="status-badge" style={{ fontSize: "0.8rem" }}>
                {isRecording
                  ? "ट्यूटर सुन रहा है..."
                  : connected
                  ? "ट्यूटर बात करने के लिए तैयार है"
                  : "ट्यूटर ऑफ़लाइन है"}
              </span>
            </div>

            {/* Subtitles/Transcript */}
            <div className="transcript-panel">
              <h3>बातचीत का विवरण (Transcript)</h3>
              <div className="transcript-area">
                {transcript.map((msg, i) => (
                  <div key={i} className={`msg ${msg.sender}`}>
                    <span className="speaker-label">{msg.sender}</span>
                    <p>{msg.text}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>

            {/* Mic Toggle Button */}
            <div className="mic-controls">
              <button
                className={`btn-mic ${isRecording ? "recording" : ""}`}
                onClick={toggleRecording}
                disabled={!connected}
                title={isRecording ? "सुनना बंद करें" : "ट्यूटर से बात करें"}
              >
                {isRecording ? (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Optional Text Input Form */}
            {connected && (
              <form onSubmit={handleSendText} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="input-key"
                  placeholder="अपना संदेह यहाँ टाइप करें..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
                <button type="submit" className="btn-connect" style={{ padding: "0.6rem 1rem" }}>
                  भेजें
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Right Column: Blackboard Canvas */}
        <section className="glass-panel">
          <div className="panel-header" style={{ background: "#05050e" }}>
            <h2>📋 Blackboard: {visualCode ? visualCode.title : "इंटरेक्टिव बोर्ड"}</h2>
          </div>
          
          {visualCode ? (
            <VisualBoard visualCode={visualCode} />
          ) : (
            <div className="blackboard-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 17l3-3 3 3" />
                <path d="M9 7h6" />
                <path d="M9 11h6" />
              </svg>
              <h3>ब्लैकबोर्ड खाली है</h3>
              <p>ट्यूटर से भौतिकी का कोई नियम पूछें (जैसे: 'Newton's law' या 'Inertia'). ट्यूटर समझाने के लिए यहाँ एक जीवंत एनीमेशन बनाएगा।</p>
            </div>
          )}
        </section>
      </main>

      <div className="debug-toggle-container">
        <button
          className="btn-debug-toggle"
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? "🛠️ Hide Debug Console" : "🛠️ Show Debug Console"}
        </button>
      </div>

      {showDebug && (
        <section className="glass-panel debug-panel">
          <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <h2>🛠️ Gemini Live API Debug Console</h2>
              {saveStatus && (
                <span className="debug-badge received" style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", fontSize: "0.75rem", textTransform: "none", marginRight: 0 }}>
                  {saveStatus}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                className="btn-clear-debug"
                style={{ borderColor: "var(--accent-secondary)", color: "#a5f3fc" }}
                onClick={() => saveLogsToFile(debugLogs)}
                disabled={debugLogs.length === 0}
              >
                💾 Save to Disk
              </button>
              <button
                className="btn-clear-debug"
                style={{ borderColor: "var(--accent-primary)", color: "#93c5fd" }}
                onClick={downloadLogs}
                disabled={debugLogs.length === 0}
              >
                📥 Download JSON
              </button>
              <button className="btn-clear-debug" onClick={clearLogs}>
                🧹 Clear Logs
              </button>
            </div>
          </div>
          <div className="debug-log-list">
            {debugLogs.length === 0 ? (
              <div className="debug-empty">No API transactions logged yet. Connect to start session.</div>
            ) : (
              debugLogs.map((log) => (
                <div key={log.id} className={`debug-log-item ${log.direction}`}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span className="debug-time">{log.time}</span>
                    <span className={`debug-badge ${log.direction}`}>{log.direction}</span>
                    <strong style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{log.type}</strong>
                  </div>
                  <pre className="debug-msg">{log.data}</pre>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
