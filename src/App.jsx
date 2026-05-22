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
  
  // Navigation
  const [activeTab, setActiveTab] = useState("coordinator");

  // Coordinator Config Settings
  const [tutorName, setTutorName] = useState(
    localStorage.getItem("tutor_name") || "Aoede — अवधी AI Tutor"
  );
  const [tutorInstructions, setTutorInstructions] = useState(
    localStorage.getItem("tutor_instructions") || ""
  );
  const [lessonPlan, setLessonPlan] = useState(() => {
    try {
      const saved = localStorage.getItem("lesson_plan");
      return saved ? JSON.parse(saved) : [
        "विराम और जड़त्व (Inertia) के नियम का परिचय (अवधी में)",
        "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
        "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
        "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
      ];
    } catch {
      return [
        "विराम और जड़त्व (Inertia) के नियम का परिचय (अवधी में)",
        "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
        "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
        "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
      ];
    }
  });
  const [defaultDialect, setDefaultDialect] = useState(
    localStorage.getItem("default_dialect") || "awadhi"
  );
  const [defaultPace, setDefaultPace] = useState(
    localStorage.getItem("default_pace") || "normal"
  );

  // Student Settings (defaults synced from coordinator settings)
  const [studentName, setStudentName] = useState("अमित कुमार");
  const [activeDialect, setActiveDialect] = useState(defaultDialect);
  const [activePace, setActivePace] = useState(defaultPace);

  // Student Diagnostic Profiles (Updated dynamically by AI Tutor tool calls)
  const [studentGaps, setStudentGaps] = useState([]);
  const [studentStrengths, setStudentStrengths] = useState([]);
  const [studentQuizScore, setStudentQuizScore] = useState(0);
  const [studentDiagnostics, setStudentDiagnostics] = useState("विद्यार्थी का प्रोफाइल अभी खाली है। ट्यूटर सत्र शुरू होने पर डायग्नोस्टिक्स रिपोर्ट यहाँ तैयार होगी।");
  const [studentCurrentStep, setStudentCurrentStep] = useState(0);

  // Active Connection State
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
  
  // Lesson plan builder local state
  const [newStepText, setNewStepText] = useState("");

  const debugLogsRef = useRef([]);
  useEffect(() => {
    debugLogsRef.current = debugLogs;
  }, [debugLogs]);

  // Sync active settings when defaults change
  useEffect(() => {
    setActiveDialect(defaultDialect);
  }, [defaultDialect]);

  useEffect(() => {
    setActivePace(defaultPace);
  }, [defaultPace]);

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

  const saveTutorConfiguration = () => {
    localStorage.setItem("tutor_name", tutorName);
    localStorage.setItem("tutor_instructions", tutorInstructions);
    localStorage.setItem("lesson_plan", JSON.stringify(lessonPlan));
    localStorage.setItem("default_dialect", defaultDialect);
    localStorage.setItem("default_pace", defaultPace);
    setSaveStatus("Tutor configuration saved successfully!");
    setTimeout(() => setSaveStatus(""), 4000);
  };

  const restoreDefaultLessonPlan = () => {
    setLessonPlan([
      "विराम और जड़त्व (Inertia) के नियम का परिचय (अवधी में)",
      "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
      "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
      "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
    ]);
  };

  const handleAddStep = (e) => {
    e.preventDefault();
    if (newStepText.trim()) {
      setLessonPlan([...lessonPlan, newStepText.trim()]);
      setNewStepText("");
    }
  };

  const handleDeleteStep = (index) => {
    setLessonPlan(lessonPlan.filter((_, i) => i !== index));
  };

  const saveDiagnosticReport = async () => {
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    
    // Construct lesson plan progress checklist
    const planProgressStr = lessonPlan.map((step, idx) => {
      let status = "⏱️ Not started";
      if (idx === studentCurrentStep) {
        status = "⚡ In Progress";
      } else if (idx < studentCurrentStep) {
        status = "✅ Completed";
      }
      return `- Step ${idx + 1}: **${step}** (${status})`;
    }).join("\n");

    const reportMarkdown = `# Student Diagnostic Report - Hazratganj Vernacular AI Tutor
**Date/Time:** ${timestamp} (IST)
**Student Name:** ${studentName}
**Assigned Tutor:** ${tutorName}

## Session Configuration
- **Selected Dialect:** ${activeDialect === "awadhi" ? "Awadhi (अवधी)" : activeDialect === "hindi" ? "Hindi (हिंदी)" : "Auto-Adapt"}
- **Selected Pace:** ${activePace === "slow" ? "Slow (धीमी)" : activePace === "normal" ? "Normal (सामान्य)" : "Fast (तेज़)"}

## Lesson Plan Progress
${planProgressStr}

## Diagnostics Profile
### Strengths Mastered
${studentStrengths.length > 0 ? studentStrengths.map(s => `- ${s}`).join("\n") : "- No strengths logged yet."}

### Identified Learning Gaps & Weaknesses
${studentGaps.length > 0 ? studentGaps.map(g => `- ${g}`).join("\n") : "- No learning gaps logged yet."}

### Quiz Performance
- **Average/Latest Score:** ${studentQuizScore}%

### Coordinator Summary Diagnostics
${studentDiagnostics}
`;

    try {
      const response = await fetch("/api/save-report", {
        method: "POST",
        headers: {
          "Content-Type": "text/markdown",
        },
        body: reportMarkdown,
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.filepath.replace(/^.*[\\\/]/, '');
        setSaveStatus(`Diagnostic report saved to /reports/${filename}`);
        setTimeout(() => setSaveStatus(""), 6000);
      } else {
        console.error("Failed to save diagnostic report:", result.error);
      }
    } catch (err) {
      console.error("Error saving diagnostic report:", err);
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
    setStudentCurrentStep(0);

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

        // Format dialect and pace instructions dynamically
        const dialectInstructions = activeDialect === "awadhi"
          ? "Speak entirely in the Awadhi dialect using Lucknow grammar, expressions, and tone. For example, use 'हमार' (hamaar), 'तोहार' (tohar), 'का हाल बा / का हाल अहै' (ka haal ba / ka haal ahai) and typical Awadhi structures."
          : activeDialect === "hindi"
          ? "Speak in standard Hindi suitable for UP Board students, using clear explanations and standard UP Board terminology."
          : "Start in standard Hindi, but dynamically adapt your language to the student's dialect (Awadhi or Hindi) and speech patterns as they talk.";

        const paceInstructions = activePace === "slow"
          ? "Speak at a slow, comfortable pace, pausing between main ideas to allow the student to digest the concepts."
          : activePace === "fast"
          ? "Speak at a quick, energetic pace, keeping explanations brief and highly dynamic."
          : "Speak at a normal, natural conversational pace.";

        // Format custom lesson plan steps list
        const lessonStepsStr = lessonPlan.map((step, idx) => `${idx + 1}. ${step}`).join("\n");

        // Dynamic system prompt incorporating coordinator settings
        const systemPrompt = 
          `You are a helpful, warm, expert vernacular AI physics tutor named "${tutorName}" from the Hazratganj coaching belt, Lucknow.\n` +
          `Your goal is to teach UP Board students physics concepts following a custom lesson plan defined by their coordinator.\n\n` +
          `LOCKED LESSON PLAN CHECKLIST:\n` +
          `${lessonStepsStr}\n\n` +
          `INSTRUCTIONS FOR CURRENT LESSON STATUS:\n` +
          `- Guide the student step-by-step through the lesson steps listed above.\n` +
          `- Inform the student of which step they are currently on and what they will learn next.\n` +
          `- Do not rush. Only proceed to the next step when the student shows understanding or prompts you to continue.\n\n` +
          `LANGUAGE & PACE ADAPTATION:\n` +
          `- Dialect instructions: ${dialectInstructions}\n` +
          `- Pace instructions: ${paceInstructions}\n\n` +
          `COORDINATOR CUSTOM PERSONA & PEDAGOGY INSTRUCTIONS:\n` +
          `${tutorInstructions || "No additional custom instructions."}\n\n` +
          `INTERACTIVE VISUAL BLACKBOARD & PROFILE DIAGNOSTICS:\n` +
          `- Your explanations of physics concepts must be accompanied by visuals. Call the tool 'explain_with_visuals' to draw interactive Canvas/SVG animations on the Blackboard.\n` +
          `- You MUST call the tool 'update_learning_profile' regularly to update the student's profile progress (identified weaknesses/gaps, mastered strengths, quiz scores out of 100, a summary, and the index of the active lesson step, starting at 0).\n` +
          `- Call 'update_learning_profile' when they struggle with a question (adds to gaps), master a concept (adds to strengths), answer a quiz question (updates quiz score), or move to a new lesson step.\n` +
          `- Keep your spoken explanations relatively short and conversational so the student doesn't have to wait, and let the blackboard do the heavy lifting.`;

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
                  text: systemPrompt
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
                  {
                    name: "update_learning_profile",
                    description:
                      "Updates the coordinator's monitoring dashboard with the student's current diagnosed learning gaps, mastered strengths, quiz scores, and the index of the active lesson plan step.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        gaps: {
                          type: "ARRAY",
                          items: {
                            type: "STRING",
                          },
                          description: "List of identified learning gaps, weaknesses, or misconceptions (e.g. ['Inertia concept confusion', 'Newton\'s 3rd law action-reaction sign error'])."
                        },
                        strengths: {
                          type: "ARRAY",
                          items: {
                            type: "STRING",
                          },
                          description: "List of concepts the student has mastered or answered correctly (e.g. ['Newton\'s 1st Law definition', 'Free-fall gravity visual understanding'])."
                        },
                        quizScore: {
                          type: "NUMBER",
                          description: "The student's average or latest quiz score as a percentage (0-100)."
                        },
                        diagnostics: {
                          type: "STRING",
                          description: "A concise summary profiling the student's current learning pace, dialect adaptation, and general status."
                        },
                        currentStepIndex: {
                          type: "INTEGER",
                          description: "The 0-based index of the active lesson plan step they are currently working on or have completed (e.g., 0 for Step 1, 1 for Step 2)."
                        }
                      },
                      required: ["gaps", "strengths", "quizScore", "diagnostics", "currentStepIndex"]
                    }
                  }
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
    // Save diagnostic report automatically on disconnect if session was active
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      saveDiagnosticReport();
    }

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
          } else if (call.name === "update_learning_profile") {
            const args = call.args;
            console.log("Updating student learning profile from tool call:", args);

            if (Array.isArray(args.gaps)) setStudentGaps(args.gaps);
            if (Array.isArray(args.strengths)) setStudentStrengths(args.strengths);
            if (typeof args.quizScore === "number") setStudentQuizScore(args.quizScore);
            if (typeof args.diagnostics === "string") setStudentDiagnostics(args.diagnostics);
            if (typeof args.currentStepIndex === "number") setStudentCurrentStep(args.currentStepIndex);

            // Send tool call response back immediately to satisfy model state
            const responseMsg = {
              toolResponse: {
                functionResponses: [
                  {
                    name: "update_learning_profile",
                    id: call.id,
                    response: {
                      output: {
                        status: "Learning profile successfully updated on the coordinator dashboard.",
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

    sendTextMessage(userText);
  };

  const sendTextMessage = (text) => {
    if (!connected) return;

    const textMsg = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text: text }],
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

  const triggerNextStep = () => {
    const nextIdx = studentCurrentStep + 1;
    if (nextIdx < lessonPlan.length) {
      const commandText = `कृप्या अगले चरण की ओर बढ़ें: "${lessonPlan[nextIdx]}"। मुझे यह विषय समझाएं और ब्लैकबोर्ड पर कोई एनीमेशन दिखाएं।`;
      setTranscript((prev) => [...prev, { sender: "user", text: `👉 (अगला चरण): ${lessonPlan[nextIdx]}` }]);
      sendTextMessage(commandText);
    } else {
      const commandText = `हमारा पाठ योजना समाप्त हो गया है। कृपया एक बार पूरा संक्षेप में रिवीजन करवाएं।`;
      setTranscript((prev) => [...prev, { sender: "user", text: `👉 (पाठ समाप्त, रिवीजन करें)` }]);
      sendTextMessage(commandText);
    }
  };

  const triggerQuiz = () => {
    const commandText = `कृपया मुझे पिछले साल के यूपी बोर्ड परीक्षा के आधार पर बल या इस पाठ पर एक नया क्विज़ (बहुविकल्पीय प्रश्न) दें और मेरा उत्तर जांचें।`;
    setTranscript((prev) => [...prev, { sender: "user", text: `📝 (क्विज़ प्रश्न का अनुरोध किया)` }]);
    sendTextMessage(commandText);
  };

  const progressPercent = lessonPlan.length > 0 
    ? Math.min(100, Math.round(((studentCurrentStep + 1) / lessonPlan.length) * 100))
    : 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>📚 अवधी AI Physics Vernacular Tutor</h1>
          <p>UP Board परीक्षा तैयारी — लखनऊ हजरतगंज कोचिंग बेल्ट एडमिन व स्टूडेंट हब</p>
        </div>
        
        {/* Tab Controls */}
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === "coordinator" ? "active" : ""}`}
            onClick={() => setActiveTab("coordinator")}
          >
            🏫 Coordinator Hub
          </button>
          <button 
            className={`tab-btn ${activeTab === "student" ? "active" : ""}`}
            onClick={() => setActiveTab("student")}
          >
            🎓 Student Classroom
          </button>
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

      {/* Main content dynamically switches tabs */}
      {activeTab === "coordinator" ? (
        <main className="coordinator-layout">
          {/* Left Panel: Tutor Designer */}
          <section className="glass-panel glow">
            <div className="panel-header">
              <h2>🛠️ Tutor Creator & Settings</h2>
            </div>
            <div className="panel-content">
              <div className="settings-group">
                <label>Gemini API Key</label>
                <input
                  type="password"
                  className="input-key"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                />
              </div>

              <div className="settings-group">
                <label>Tutor Name (ट्यूटर का नाम)</label>
                <input
                  type="text"
                  className="input-key"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  placeholder="ट्यूटर का नाम लिखें..."
                />
              </div>

              <div className="settings-group">
                <label>Coordinator Instruction Overlay (कस्टम निर्देश)</label>
                <textarea
                  className="input-key text-area-instructions"
                  rows={3}
                  value={tutorInstructions}
                  onChange={(e) => setTutorInstructions(e.target.value)}
                  placeholder="उदा. 'हजरतगंज कोचिंग स्टाइल का प्रयोग करें, हजरतगंज मार्केट का उदाहरण देकर बल समझाएं...'"
                />
              </div>

              <div className="settings-row">
                <div className="settings-group half-width">
                  <label>Default Dialect (भाषा)</label>
                  <select 
                    className="input-key select-custom" 
                    value={defaultDialect}
                    onChange={(e) => setDefaultDialect(e.target.value)}
                  >
                    <option value="awadhi">Awadhi (अवधी)</option>
                    <option value="hindi">Hindi (हिंदी)</option>
                    <option value="auto">Auto-Adapt (स्वचालित)</option>
                  </select>
                </div>
                <div className="settings-group half-width">
                  <label>Default Pace (गति)</label>
                  <select 
                    className="input-key select-custom" 
                    value={defaultPace}
                    onChange={(e) => setDefaultPace(e.target.value)}
                  >
                    <option value="slow">Slow (धीमी)</option>
                    <option value="normal">Normal (सामान्य)</option>
                    <option value="fast">Fast (तेज़)</option>
                  </select>
                </div>
              </div>

              <div className="settings-group lesson-builder-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Lesson Plan Steps (पाठ योजना चरण)</label>
                  <button 
                    type="button" 
                    className="btn-text-only"
                    onClick={restoreDefaultLessonPlan}
                  >
                    Restore Defaults
                  </button>
                </div>
                
                <div className="lesson-plan-list">
                  {lessonPlan.map((step, index) => (
                    <div key={index} className="step-builder-item">
                      <span className="step-num">{index + 1}</span>
                      <span className="step-text">{step}</span>
                      <button 
                        type="button" 
                        className="btn-delete-step"
                        onClick={() => handleDeleteStep(index)}
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddStep} className="add-step-form">
                  <input
                    type="text"
                    className="input-key add-step-input"
                    placeholder="नया पाठ चरण जोड़ें (उदा. 'जड़त्व और घर्षण क्विज़')..."
                    value={newStepText}
                    onChange={(e) => setNewStepText(e.target.value)}
                  />
                  <button type="submit" className="btn-add-step">
                    ➕ Add
                  </button>
                </form>
              </div>

              <button 
                className="btn-connect" 
                onClick={saveTutorConfiguration}
                style={{ marginTop: "1rem" }}
              >
                💾 Save Tutor Configuration
              </button>
            </div>
          </section>

          {/* Right Panel: Student Dashboard Monitor */}
          <section className="glass-panel">
            <div className="panel-header">
              <h2>📊 Live Student Monitor</h2>
            </div>
            <div className="panel-content dashboard-content">
              <div className="student-profile-header">
                <div className="settings-group" style={{ flexGrow: 1 }}>
                  <label>Active Student Name (छात्र का नाम)</label>
                  <input
                    type="text"
                    className="input-key"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div className="quiz-score-circle">
                  <div className="score-val">{studentQuizScore}%</div>
                  <div className="score-lbl">Quiz Score</div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="dashboard-progress-section">
                <div className="progress-labels">
                  <span>Lesson Progress</span>
                  <span>Step {studentCurrentStep + 1} of {lessonPlan.length}</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <p className="active-step-hint">
                  <strong>Active Step:</strong> {lessonPlan[studentCurrentStep] || "Not Started"}
                </p>
              </div>

              {/* Diagnosed Gaps */}
              <div className="diagnostics-card">
                <h3>⚠️ Diagnosed Learning Gaps & Weaknesses</h3>
                {studentGaps.length === 0 ? (
                  <p className="no-data-text">कोई कमजोरी या अंतर अभी तक रिपोर्ट नहीं किया गया है।</p>
                ) : (
                  <div className="badges-container">
                    {studentGaps.map((gap, i) => (
                      <span key={i} className="badge gap-badge">🔍 {gap}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mastered Strengths */}
              <div className="diagnostics-card">
                <h3>✅ Mastered Strengths & Concepts</h3>
                {studentStrengths.length === 0 ? (
                  <p className="no-data-text">कोई महारत हासिल अवधारणा अभी तक रिपोर्ट नहीं की गई है।</p>
                ) : (
                  <div className="badges-container">
                    {studentStrengths.map((str, i) => (
                      <span key={i} className="badge strength-badge">⚡ {str}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Diagnostic Summary */}
              <div className="diagnostics-card flex-grow-card">
                <h3>📝 Profile Diagnostics Summary</h3>
                <div className="summary-text-box">
                  {studentDiagnostics}
                </div>
              </div>

              <div className="report-actions" style={{ display: "flex", gap: "1rem" }}>
                <button 
                  className="btn-connect" 
                  style={{ flex: 1 }}
                  onClick={saveDiagnosticReport}
                >
                  📥 Export Markdown Report
                </button>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="main-grid">
          {/* Left Column: Student Classroom */}
          <section className="glass-panel glow">
            <div className="panel-header">
              <h2>🗣️ AI Classroom: {tutorName}</h2>
            </div>

            <div className="panel-content">
              {/* Classroom settings and connection */}
              {!connected ? (
                <div className="classroom-init-settings">
                  <div className="settings-row" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
                    <div className="settings-group half-width">
                      <label>Dialect (बोली)</label>
                      <select 
                        className="input-key select-custom" 
                        value={activeDialect}
                        onChange={(e) => setActiveDialect(e.target.value)}
                      >
                        <option value="awadhi">Awadhi (अवधी)</option>
                        <option value="hindi">Hindi (हिंदी)</option>
                        <option value="auto">Auto-Adapt (स्वचालित)</option>
                      </select>
                    </div>
                    <div className="settings-group half-width">
                      <label>Pace (गति)</label>
                      <select 
                        className="input-key select-custom" 
                        value={activePace}
                        onChange={(e) => setActivePace(e.target.value)}
                      >
                        <option value="slow">Slow (धीमी)</option>
                        <option value="normal">Normal (सामान्य)</option>
                        <option value="fast">Fast (तेज़)</option>
                      </select>
                    </div>
                  </div>
                  <button
                    className="btn-connect"
                    onClick={connectSession}
                    disabled={connecting}
                  >
                    {connecting ? "ट्यूटर कनेक्ट हो रहा है..." : "ट्यूटर से बातचीत शुरू करें (Connect)"}
                  </button>
                </div>
              ) : (
                <div className="connected-classroom-header">
                  <div className="student-badge-info">
                    👤 छात्र: <strong>{studentName}</strong> | 🗣️ {activeDialect === "awadhi" ? "अवधी" : activeDialect === "hindi" ? "हिंदी" : "अनुकूलनीय"}
                  </div>
                  <button
                    className="btn-connect disconnect"
                    onClick={disconnectSession}
                    style={{ padding: "0.5rem" }}
                  >
                    सत्र समाप्त करें (Disconnect)
                  </button>
                </div>
              )}

              {/* Dynamic Lesson Plan Checklist for Student */}
              <div className="student-checklist-container">
                <h3>📖 Lesson Roadmap Checklist</h3>
                <div className="roadmap-checklist">
                  {lessonPlan.map((step, idx) => {
                    let itemClass = "upcoming";
                    let icon = "⏱️";
                    if (idx === studentCurrentStep) {
                      itemClass = "active";
                      icon = "⚡";
                    } else if (idx < studentCurrentStep) {
                      itemClass = "completed";
                      icon = "✅";
                    }
                    return (
                      <div key={idx} className={`checklist-item ${itemClass}`}>
                        <span className="checklist-icon">{icon}</span>
                        <span className="checklist-text">{step}</span>
                      </div>
                    );
                  })}
                </div>

                {connected && (
                  <div className="quick-actions-bar">
                    <button 
                      type="button" 
                      className="btn-quick-action proceed"
                      onClick={triggerNextStep}
                    >
                      आगे बढ़ें (Next Step) 👉
                    </button>
                    <button 
                      type="button" 
                      className="btn-quick-action quiz"
                      onClick={triggerQuiz}
                    >
                      📝 Take Quiz
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar Visualization */}
              <div className="avatar-container" style={{ padding: "0.5rem 0" }}>
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
                    <span style={{ fontSize: "2rem" }}>🪐</span>
                  </div>
                </div>
              </div>

              {/* Subtitles/Transcript */}
              <div className="transcript-panel">
                <h3>कक्षा संवाद (Transcript)</h3>
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
                    placeholder="ट्यूटर को संदेश भेजें (जैसे: 'Newton's law visual code change')..."
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
      )}

      {/* Persistent Collapsible Debug logs console */}
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
                💾 Save Logs
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
