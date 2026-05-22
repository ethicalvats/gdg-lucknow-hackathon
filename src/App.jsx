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
  // Routing State (Simple SPA Pathname and Query parsing)
  const [route, setRoute] = useState(window.location.pathname);
  const [searchQuery, setSearchQuery] = useState(window.location.search);
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState(null);

  // Server state data
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState("");

  // Coordinator Forms State
  const [tutorName, setTutorName] = useState("");
  const [tutorInstructions, setTutorInstructions] = useState("");
  const [lessonPlan, setLessonPlan] = useState([
    "विराम और जड़त्व (Inertia) के नियम का परिचय (अवधी में)",
    "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
    "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ]);
  const [defaultDialect, setDefaultDialect] = useState("awadhi");
  const [defaultPace, setDefaultPace] = useState("normal");
  const [newStepText, setNewStepText] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // Student Active Session State
  const [activeStudent, setActiveStudent] = useState(null);
  const [assignedTutor, setAssignedTutor] = useState(null);
  const [activeDialect, setActiveDialect] = useState("awadhi");
  const [activePace, setActivePace] = useState("normal");

  // Student Live Diagnostics Profile
  const [studentGaps, setStudentGaps] = useState([]);
  const [studentStrengths, setStudentStrengths] = useState([]);
  const [studentQuizScore, setStudentQuizScore] = useState(0);
  const [studentDiagnostics, setStudentDiagnostics] = useState("विद्यार्थी का प्रोफाइल अभी खाली है। ट्यूटर सत्र शुरू होने पर डायग्नोस्टिक्स रिपोर्ट यहाँ तैयार होगी।");
  const [studentCurrentStep, setStudentCurrentStep] = useState(0);

  // Active Connection State
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [transcript, setTranscript] = useState([
    {
      sender: "tutor",
      text: "नमस्ते! हम तोहार अवधी AI Tutor अही। हमसे भौतिकी (Physics) या कौनो और विषय के बारे में पूछें, और हम तोहार संदेह दूर करब और blackboard पर चित्र बनाकर समझाइब।",
    },
  ]);
  const [visualCode, setVisualCode] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);

  const debugLogsRef = useRef([]);
  useEffect(() => {
    debugLogsRef.current = debugLogs;
  }, [debugLogs]);

  // SPA Navigator
  const navigateTo = (pathWithSearch) => {
    window.history.pushState(null, "", pathWithSearch);
    const [path, search] = pathWithSearch.split("?");
    setRoute(path);
    setSearchQuery(search ? "?" + search : "");
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoute(window.location.pathname);
      setSearchQuery(window.location.search);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Fetch Server State & Polling
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setTutors(data.tutors || []);
      setStudents(data.students || []);
      setApiKey(data.apiKey || "");
    } catch (err) {
      console.error("Failed to fetch server state:", err);
    }
  };

  useEffect(() => {
    fetchState();
    let interval = null;
    if (route === "/coordinator") {
      interval = setInterval(() => {
        fetchState();
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [route]);

  // Read student detail if id query param exists on student route
  const parsedSearch = new URLSearchParams(searchQuery);
  const activeStudentId = parsedSearch.get("studentId");

  const fetchStudentDetail = async (studentId) => {
    try {
      const response = await fetch(`/api/student-detail?studentId=${studentId}`);
      const data = await response.json();
      if (data.success) {
        setActiveStudent(data.student);
        setAssignedTutor(data.tutor);
        setApiKey(data.apiKey || "");
        
        if (data.tutor) {
          setActiveDialect(data.tutor.dialect || "awadhi");
          setActivePace(data.tutor.pace || "normal");
          setStudentCurrentStep(data.student.currentStepIndex || 0);
          setStudentGaps(data.student.gaps || []);
          setStudentStrengths(data.student.strengths || []);
          setStudentQuizScore(data.student.quizScore || 0);
          setStudentDiagnostics(data.student.diagnostics || "विद्यार्थी का प्रोफाइल अभी खाली है।");
        }
      } else {
        setError("विद्यार्थी रिकॉर्ड प्राप्त करने में विफल: " + data.error);
        setActiveStudent(null);
        setAssignedTutor(null);
      }
    } catch (err) {
      console.error("Failed to fetch student details:", err);
      setError("सर्वर से विद्यार्थी डेटा लोड करने में त्रुटि हुई।");
    }
  };

  useEffect(() => {
    if (route === "/student" && activeStudentId) {
      fetchStudentDetail(activeStudentId);
    }
  }, [route, searchQuery, activeStudentId]);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logsToSave, null, 2),
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.filepath.replace(/^.*[\\\/]/, '');
        setSaveStatus(`Logs auto-saved to /logs/${filename}`);
        setTimeout(() => setSaveStatus(""), 6000);
      }
    } catch (err) {
      console.error("Error saving logs:", err);
    }
  };

  // Coordinator Actions
  const handleSaveApiKey = async (key) => {
    setApiKey(key);
    try {
      await fetch("/api/save-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      setSaveStatus("API key saved on server!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err) {
      console.error("Failed to save API key on server:", err);
    }
  };

  const handleCreateTutor = async (e) => {
    e.preventDefault();
    if (!tutorName.trim()) return;

    const newTutor = {
      id: "tutor_" + Date.now(),
      name: tutorName.trim(),
      instructions: tutorInstructions.trim(),
      lessonPlan,
      dialect: defaultDialect,
      pace: defaultPace,
    };

    try {
      const response = await fetch("/api/tutors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTutor),
      });
      const data = await response.json();
      if (data.success) {
        setTutors(data.tutors);
        setTutorName("");
        setTutorInstructions("");
        setLessonPlan([
          "विराम और जड़त्व (Inertia) के नियम का परिचय (अवधी में)",
          "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
          "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
          "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
        ]);
        setSaveStatus("Tutor template created!");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      console.error("Failed to create tutor template:", err);
    }
  };

  const handleDeleteTutor = async (tutorId) => {
    try {
      const response = await fetch("/api/tutors/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId }),
      });
      const data = await response.json();
      if (data.success) {
        setTutors(data.tutors);
        setSaveStatus("Tutor template deleted.");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      console.error("Failed to delete tutor template:", err);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;

    const newStudent = {
      id: "student_" + Date.now(),
      name: newStudentName.trim(),
      assignedTutorId: "",
      gaps: [],
      strengths: [],
      quizScore: 0,
      diagnostics: "विद्यार्थी का प्रोफाइल अभी खाली है। ट्यूटर सत्र शुरू होने पर डायग्नोस्टिक्स रिपोर्ट यहाँ तैयार होगी।",
      currentStepIndex: 0
    };

    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStudent),
      });
      const data = await response.json();
      if (data.success) {
        setStudents(data.students);
        setNewStudentName("");
        setSaveStatus("Student registered!");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      console.error("Failed to register student:", err);
    }
  };

  const handleDeleteStudent = async (studentId) => {
    try {
      const response = await fetch("/api/students/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await response.json();
      if (data.success) {
        setStudents(data.students);
        if (selectedStudentId === studentId) {
          setSelectedStudentId("");
        }
        setSaveStatus("Student deleted.");
        setTimeout(() => setSaveStatus(""), 3000);
      }
    } catch (err) {
      console.error("Failed to delete student:", err);
    }
  };

  const handleAssignTutor = async (studentId, tutorId) => {
    try {
      const response = await fetch("/api/assign-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, tutorId }),
      });
      const data = await response.json();
      if (data.success) {
        setSaveStatus("Tutor assigned!");
        setTimeout(() => setSaveStatus(""), 3000);
        fetchState();
      }
    } catch (err) {
      console.error("Failed to assign tutor template:", err);
    }
  };

  const handleResetStudentProgress = async (studentId) => {
    if (!studentId) return;
    try {
      const response = await fetch("/api/update-student-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          gaps: [],
          strengths: [],
          quizScore: 0,
          diagnostics: "प्रगति और पाठ योजना रीसेट की गई।",
          currentStepIndex: 0,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSaveStatus("प्रगति रीसेट कर दी गई है!");
        setTimeout(() => setSaveStatus(""), 3000);
        
        if (activeStudentId === studentId) {
          setStudentCurrentStep(0);
          setStudentGaps([]);
          setStudentStrengths([]);
          setStudentQuizScore(0);
          setStudentDiagnostics("प्रगति और पाठ योजना रीसेट की गई।");
          setActiveQuiz(null);
          fetchStudentDetail(studentId);
        }
        
        fetchState();
      }
    } catch (err) {
      console.error("Failed to reset student progress:", err);
    }
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

  // Student Diagnostics Saving Actions
  const updateStudentDiagnosticsOnServer = async ({ gaps, strengths, quizScore, diagnostics, currentStepIndex }) => {
    if (!activeStudentId) return;
    try {
      await fetch("/api/update-student-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: activeStudentId,
          gaps,
          strengths,
          quizScore,
          diagnostics,
          currentStepIndex,
        }),
      });
    } catch (err) {
      console.error("Failed to update student diagnostics on server:", err);
    }
  };

  const handleSelectQuizOption = async (optionIndex) => {
    if (!activeQuiz || activeQuiz.submitted) return;
    
    const isCorrect = optionIndex === activeQuiz.correctOptionIndex;
    
    const updatedQuiz = {
      ...activeQuiz,
      selectedOptionIndex: optionIndex,
      submitted: true
    };
    setActiveQuiz(updatedQuiz);

    setTranscript(prev => [
      ...prev,
      {
        sender: "student",
        text: `[Selected Option: ${activeQuiz.options[optionIndex]} - ${isCorrect ? "Correct (सही)" : "Incorrect (गलत)"}]`
      }
    ]);

    let newScore = studentQuizScore;
    if (isCorrect) {
      newScore = Math.min(100, studentQuizScore + 25);
    } else {
      newScore = Math.max(0, studentQuizScore - 10);
    }
    setStudentQuizScore(newScore);

    let updatedStrengths = [...studentStrengths];
    let updatedGaps = [...studentGaps];
    const conceptTag = activeQuiz.question.substring(0, 35) + "...";
    
    if (isCorrect) {
      if (!updatedStrengths.includes(conceptTag)) {
        updatedStrengths.push(conceptTag);
      }
      updatedGaps = updatedGaps.filter(g => g !== conceptTag);
    } else {
      if (!updatedGaps.includes(conceptTag)) {
        updatedGaps.push(conceptTag);
      }
    }

    setStudentStrengths(updatedStrengths);
    setStudentGaps(updatedGaps);

    updateStudentDiagnosticsOnServer({
      gaps: updatedGaps,
      strengths: updatedStrengths,
      quizScore: newScore,
      diagnostics: `प्रश्नोत्तरी में छात्र का प्रदर्शन। अंतिम प्रश्न: '${activeQuiz.question.substring(0, 40)}...'. परिणाम: ${isCorrect ? "सही उत्तर" : "गलत उत्तर"}`,
      currentStepIndex: studentCurrentStep
    });

    const responseMsg = {
      toolResponse: {
        functionResponses: [
          {
            name: "render_interactive_quiz",
            id: activeQuiz.wsCallId,
            response: {
              output: {
                status: isCorrect ? "correct" : "incorrect",
                studentSelectedOption: activeQuiz.options[optionIndex],
                correctOption: activeQuiz.options[activeQuiz.correctOptionIndex],
                explanation: activeQuiz.explanation
              }
            }
          }
        ]
      }
    };

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(responseMsg));
      logDebug("sent", "TOOL_RESPONSE", responseMsg);
    }
  };

  const saveDiagnosticReport = async () => {
    if (!activeStudent) return;
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    
    const planSteps = assignedTutor ? assignedTutor.lessonPlan : [];
    const planProgressStr = planSteps.map((step, idx) => {
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
**Student Name:** ${activeStudent.name}
**Student ID:** ${activeStudent.id}
**Assigned Tutor:** ${assignedTutor ? assignedTutor.name : "N/A"}

## Session Configuration
- **Selected Dialect:** ${activeDialect === "awadhi" ? "Awadhi (अवधी)" : activeDialect === "hindi" ? "Hindi (हिंदी)" : "Auto-Adapt"}
- **Selected Pace:** ${activePace === "slow" ? "Slow (धीमी)" : activePace === "normal" ? "Normal (सामान्य)" : "Fast (तेज़)"}

## Lesson Plan Progress
${planProgressStr || "- No lesson plan assigned."}

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
        headers: { "Content-Type": "text/markdown" },
        body: reportMarkdown,
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.filepath.replace(/^.*[\\\/]/, '');
        setSaveStatus(`Diagnostic report saved to /reports/${filename}`);
        setTimeout(() => setSaveStatus(""), 6000);
      }
    } catch (err) {
      console.error("Error saving diagnostic report:", err);
    }
  };

  const exportCoordinatorStudentReport = async (studentToExport) => {
    if (!studentToExport) return;
    const assignedTutorObj = tutors.find(t => t.id === studentToExport.assignedTutorId);
    const planSteps = assignedTutorObj ? assignedTutorObj.lessonPlan : [];
    
    const planProgressStr = planSteps.map((step, idx) => {
      let status = "⏱️ Not started";
      if (idx === studentToExport.currentStepIndex) {
        status = "⚡ In Progress";
      } else if (idx < studentToExport.currentStepIndex) {
        status = "✅ Completed";
      }
      return `- Step ${idx + 1}: **${step}** (${status})`;
    }).join("\n");

    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const reportMarkdown = `# Student Diagnostic Report - Hazratganj Vernacular AI Tutor
**Date/Time:** ${timestamp} (IST)
**Student Name:** ${studentToExport.name}
**Student ID:** ${studentToExport.id}
**Assigned Tutor:** ${assignedTutorObj ? assignedTutorObj.name : "N/A"}

## Session Configuration
- **Dialect:** ${assignedTutorObj ? assignedTutorObj.dialect : "awadhi"}
- **Pace:** ${assignedTutorObj ? assignedTutorObj.pace : "normal"}

## Lesson Plan Progress
${planProgressStr || "- No lesson plan assigned."}

## Diagnostics Profile
### Strengths Mastered
${studentToExport.strengths && studentToExport.strengths.length > 0 ? studentToExport.strengths.map(s => `- ${s}`).join("\n") : "- No strengths logged yet."}

### Identified Learning Gaps & Weaknesses
${studentToExport.gaps && studentToExport.gaps.length > 0 ? studentToExport.gaps.map(g => `- ${g}`).join("\n") : "- No learning gaps logged yet."}

### Quiz Performance
- **Average/Latest Score:** ${studentToExport.quizScore || 0}%

### Coordinator Summary Diagnostics
${studentToExport.diagnostics || "No diagnostics summary logged yet."}
`;

    try {
      const response = await fetch("/api/save-report", {
        method: "POST",
        headers: { "Content-Type": "text/markdown" },
        body: reportMarkdown,
      });
      const result = await response.json();
      if (result.success) {
        const filename = result.filepath.replace(/^.*[\\\/]/, '');
        setSaveStatus(`Diagnostic report saved to /reports/${filename}`);
        setTimeout(() => setSaveStatus(""), 6000);
      }
    } catch (err) {
      console.error("Error exporting report:", err);
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

  const connectSession = () => {
    if (!apiKey) {
      setError("कोऑर्डिनेटर ने अभी तक API key दर्ज नहीं की है। कृपया पहले कोऑर्डिनेटर हब में जाकर एपीआई कुंजी दर्ज करें।");
      return;
    }
    if (!assignedTutor) {
      setError("विद्यार्थी को अभी कोई ट्यूटर असाइन नहीं किया गया है। कृपया कोऑर्डिनेटर हब में ट्यूटर असाइन करें।");
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
        const lessonStepsStr = assignedTutor.lessonPlan.map((step, idx) => `${idx + 1}. ${step}`).join("\n");

        // Dynamic system prompt incorporating coordinator settings
        const systemPrompt = 
          `You are a helpful, warm, expert vernacular AI physics tutor named "${assignedTutor.name}" from the Hazratganj coaching belt, Lucknow.\n` +
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
          `${assignedTutor.instructions || "No additional custom instructions."}\n\n` +
          `INTERACTIVE VISUAL BLACKBOARD & PROFILE DIAGNOSTICS:\n` +
          `- Your explanations of physics concepts must be accompanied by visuals. Call the tool 'explain_with_visuals' to draw interactive Canvas/SVG animations on the Blackboard.\n` +
          `- When evaluating or quizzing the student, you MUST call the tool 'render_interactive_quiz' to present a multiple-choice question on the student's screen. Do not just speak the quiz in audio. Provide the question, 4 options, the correct option index, and a short explanation. The system will pause speaking and wait for the student to select and submit their choice. Once the student submits, you will receive the correctness back as a tool response. Speak the explanation and guide them accordingly.\n` +
          `- You MUST call the tool 'update_learning_profile' regularly to update the student's profile progress (identified weaknesses/gaps, mastered strengths, quiz scores out of 100, a summary, and the index of the active lesson step, starting at 0).\n` +
          `- Call 'update_learning_profile' when they struggle with a question (adds to gaps), master a concept (adds to strengths), answer a quiz question (updates quiz score), or move to a new lesson step.\n` +
          `- Keep your spoken explanations relatively short and conversational so the student doesn't have to wait, and let the blackboard do the heavy lifting.`;

        // Send Setup message immediately
        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview", 
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede", 
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
                  },
                  {
                    name: "render_interactive_quiz",
                    description: "Displays an interactive multiple-choice physics quiz question on the student's screen. The voice tutor will pause and wait for the student to select and submit their answer.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        question: {
                          type: "STRING",
                          description: "The quiz question text, written in Hindi/Awadhi."
                        },
                        options: {
                          type: "ARRAY",
                          items: {
                            type: "STRING"
                          },
                          description: "List of exactly 4 multiple-choice options."
                        },
                        correctOptionIndex: {
                          type: "INTEGER",
                          description: "The 0-based index of the correct option (0, 1, 2, or 3)."
                        },
                        explanation: {
                          type: "STRING",
                          description: "A short explanation of the correct answer, in Hindi/Awadhi."
                        }
                      },
                      required: ["question", "options", "correctOptionIndex", "explanation"]
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
        setError("WebSocket कनेक्शन में त्रुटि हुई।");
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
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      saveDiagnosticReport();
    }

    saveLogsToFile(debugLogsRef.current);

    if (recorder.current) {
      recorder.current.stop();
      recorder.current = null;
    }
    setIsRecording(false);

    if (player.current) {
      player.current.close();
      player.current = null;
    }

    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      ws.current = null;
    }

    setConnected(false);
    setConnecting(false);
    setActiveQuiz(null);
  };

  const handleServerMessage = (data) => {
    if (data.serverContent?.interrupted) {
      console.log("Model response interrupted by user talk");
      player.current?.stop();
      return;
    }

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

            const newGaps = Array.isArray(args.gaps) ? args.gaps : studentGaps;
            const newStrengths = Array.isArray(args.strengths) ? args.strengths : studentStrengths;
            const newQuizScore = typeof args.quizScore === "number" ? args.quizScore : studentQuizScore;
            const newDiagnostics = typeof args.diagnostics === "string" ? args.diagnostics : studentDiagnostics;
            const newCurrentStep = typeof args.currentStepIndex === "number" ? args.currentStepIndex : studentCurrentStep;

            setStudentGaps(newGaps);
            setStudentStrengths(newStrengths);
            setStudentQuizScore(newQuizScore);
            setStudentDiagnostics(newDiagnostics);
            setStudentCurrentStep(newCurrentStep);

            // Persist straight to Vite node server state files
            updateStudentDiagnosticsOnServer({
              gaps: newGaps,
              strengths: newStrengths,
              quizScore: newQuizScore,
              diagnostics: newDiagnostics,
              currentStepIndex: newCurrentStep,
            });

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
          } else if (call.name === "render_interactive_quiz") {
            const args = call.args;
            console.log("Interactive quiz tool call received:", args);
            setActiveQuiz({
              question: args.question,
              options: Array.isArray(args.options) ? args.options : [],
              correctOptionIndex: typeof args.correctOptionIndex === "number" ? args.correctOptionIndex : 0,
              explanation: args.explanation || "",
              selectedOptionIndex: null,
              submitted: false,
              wsCallId: call.id
            });
            // We do NOT send a toolResponse immediately.
            // The client will render the quiz on screen and wait for user's click.
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
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, text: lastMsg.text + textChunk },
            ];
          } else {
            return [...prev, { sender: "tutor", text: textChunk }];
          }
        });
      }
    }
  };

  const toggleRecording = async () => {
    if (!connected) return;

    if (isRecording) {
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
      setError(null);
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
    const planSteps = assignedTutor ? assignedTutor.lessonPlan : [];
    const nextIdx = studentCurrentStep + 1;
    if (nextIdx < planSteps.length) {
      const commandText = `कृप्या अगले चरण की ओर बढ़ें: "${planSteps[nextIdx]}"। मुझे यह विषय समझाएं और ब्लैकबोर्ड पर कोई एनीमेशन दिखाएं।`;
      setTranscript((prev) => [...prev, { sender: "user", text: `👉 (अगला चरण): ${planSteps[nextIdx]}` }]);
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

  const activePlanSteps = assignedTutor ? assignedTutor.lessonPlan : [];
  const progressPercent = activePlanSteps.length > 0 
    ? Math.min(100, Math.round(((studentCurrentStep + 1) / activePlanSteps.length) * 100))
    : 0;

  // ROUTE RENDERING LOGIC
  
  // 1. Landing Gateway Page
  if (route === "/") {
    return (
      <div className="landing-container">
        <div className="landing-hero">
          <h1>📚 अवधी AI Physics Vernacular Classroom</h1>
          <p>Lucknow Hazratganj Coaching Belt Hub — UP Board Exams Gateway</p>
        </div>
        <div className="landing-grid">
          <div className="landing-card" onClick={() => navigateTo("/coordinator")}>
            <div className="landing-card-icon">🏫</div>
            <h2>Coordinator Portal</h2>
            <p>Create templates for AI tutors with custom step-by-step lesson plans, register state-board students, assign paths, and monitor performance analytics in real-time.</p>
            <span className="landing-card-btn">Enter Admin Hub →</span>
          </div>
          <div className="landing-card" onClick={() => navigateTo("/student")}>
            <div className="landing-card-icon">🎓</div>
            <h2>Student Classroom</h2>
            <p>Access your personal dashboard. Connect with your assigned vernacular AI tutor, learn concepts via speech, and interact with the animated blackboard.</p>
            <span className="landing-card-btn">Start Learning →</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Coordinator Hub Portal
  if (route === "/coordinator") {
    const activeSelectedStudent = students.find(s => s.id === selectedStudentId);
    
    return (
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1 className="clickable-title" onClick={() => navigateTo("/")}>🏫 Coordinator Admin Hub</h1>
            <p>Manage Tutors, Register state-board Students, and Monitor Live Diagnostic Logs</p>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button className="btn-back-home" onClick={() => navigateTo("/")}>
              🔙 Main Gateway
            </button>
            {saveStatus && (
              <span className="debug-badge received" style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", fontSize: "0.8rem", textTransform: "none" }}>
                {saveStatus}
              </span>
            )}
          </div>
        </header>

        <main className="coordinator-layout three-column">
          {/* Column 1: Config Settings & Tutor Templates Creator */}
          <section className="glass-panel glow">
            <div className="panel-header">
              <h2>🛠️ 1. Global Setup & Tutors</h2>
            </div>
            <div className="panel-content">
              <div className="settings-group">
                <label>Gemini API Key (Saved on Server)</label>
                <input
                  type="password"
                  className="input-key"
                  placeholder={apiKey ? "••••••••••••••••" : "API Key empty..."}
                  onChange={(e) => handleSaveApiKey(e.target.value)}
                />
              </div>

              <div className="tutor-templates-section">
                <h3>Created Tutors ({tutors.length})</h3>
                <div className="list-card-container">
                  {tutors.length === 0 ? (
                    <p className="no-data-text">कोई ट्यूटर नहीं बना है। नीचे नया ट्यूटर बनाएं।</p>
                  ) : (
                    tutors.map(t => (
                      <div key={t.id} className="crud-list-item">
                        <div className="crud-item-info">
                          <strong>{t.name}</strong>
                          <span>{t.dialect === "awadhi" ? "अवधी" : t.dialect === "hindi" ? "हिंदी" : "Auto"} | {t.pace}</span>
                        </div>
                        <button className="btn-crud-delete" onClick={() => handleDeleteTutor(t.id)}>❌</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form onSubmit={handleCreateTutor} className="tutor-create-form border-top">
                <h3>Create New Tutor Template</h3>
                <div className="settings-group">
                  <label>Tutor Name</label>
                  <input
                    type="text"
                    className="input-key"
                    required
                    value={tutorName}
                    onChange={(e) => setTutorName(e.target.value)}
                    placeholder="उदा. भौतिकी गुरु"
                  />
                </div>
                <div className="settings-group">
                  <label>Custom Instructions Persona Overlay</label>
                  <textarea
                    className="input-key text-area-instructions"
                    rows={2}
                    value={tutorInstructions}
                    onChange={(e) => setTutorInstructions(e.target.value)}
                    placeholder="उदा. 'उदार बनें, हजरतगंज गोमती नदी के उदाहरणों का प्रयोग करें...'"
                  />
                </div>
                <div className="settings-row">
                  <div className="settings-group half-width">
                    <label>Dialect</label>
                    <select className="input-key select-custom" value={defaultDialect} onChange={(e) => setDefaultDialect(e.target.value)}>
                      <option value="awadhi">Awadhi (अवधी)</option>
                      <option value="hindi">Hindi (हिंदी)</option>
                      <option value="auto">Auto-Adapt (स्वचालित)</option>
                    </select>
                  </div>
                  <div className="settings-group half-width">
                    <label>Pace</label>
                    <select className="input-key select-custom" value={defaultPace} onChange={(e) => setDefaultPace(e.target.value)}>
                      <option value="slow">Slow (धीमी)</option>
                      <option value="normal">Normal (सामान्य)</option>
                      <option value="fast">Fast (तेज़)</option>
                    </select>
                  </div>
                </div>

                <div className="settings-group lesson-builder-box" style={{ marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label>Lesson Roadmap Steps</label>
                    <button type="button" className="btn-text-only" onClick={restoreDefaultLessonPlan}>Restore Defaults</button>
                  </div>
                  
                  <div className="lesson-plan-list small-height">
                    {lessonPlan.map((step, idx) => (
                      <div key={idx} className="step-builder-item">
                        <span className="step-num">{idx + 1}</span>
                        <span className="step-text">{step}</span>
                        <button type="button" className="btn-delete-step" onClick={() => handleDeleteStep(idx)}>❌</button>
                      </div>
                    ))}
                  </div>
                  <div className="add-step-form">
                    <input
                      type="text"
                      className="input-key add-step-input"
                      placeholder="नया पाठ चरण..."
                      value={newStepText}
                      onChange={(e) => setNewStepText(e.target.value)}
                    />
                    <button type="button" className="btn-add-step" onClick={(e) => handleAddStep(e)}>➕</button>
                  </div>
                </div>

                <button type="submit" className="btn-connect" style={{ marginTop: "0.75rem", width: "100%" }}>
                  ➕ Create Tutor Template
                </button>
              </form>
            </div>
          </section>

          {/* Column 2: Students registry & assignments manager */}
          <section className="glass-panel glow">
            <div className="panel-header">
              <h2>👥 2. Student Roster & Assignments</h2>
            </div>
            <div className="panel-content">
              <form onSubmit={handleCreateStudent} className="student-register-form">
                <h3>Register Student Profile</h3>
                <div className="add-step-form">
                  <input
                    type="text"
                    className="input-key"
                    required
                    placeholder="छात्र का नाम लिखें..."
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                  />
                  <button type="submit" className="btn-add-step">➕ Register</button>
                </div>
              </form>

              <div className="student-assignments-section" style={{ marginTop: "1rem" }}>
                <h3>Assigned Students & Tutors</h3>
                <div className="list-card-container scrollable-roster">
                  {students.length === 0 ? (
                    <p className="no-data-text">कोई छात्र पंजीकृत नहीं है। ऊपर नया छात्र जोड़ें।</p>
                  ) : (
                    students.map(s => (
                      <div key={s.id} className="crud-list-item assign-row">
                        <div className="crud-item-info">
                          <strong>{s.name}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>ID: {s.id}</span>
                        </div>
                        <div className="assign-controls">
                          <select
                            value={s.assignedTutorId || ""}
                            onChange={(e) => handleAssignTutor(s.id, e.target.value)}
                            className="input-key select-custom select-inline"
                          >
                            <option value="">-- No Tutor --</option>
                            {tutors.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button className="btn-crud-delete" onClick={() => handleDeleteStudent(s.id)}>❌</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Column 3: Live student monitor & reports exporter */}
          <section className="glass-panel">
            <div className="panel-header">
              <h2>📊 3. Live Diagnostics Dashboard</h2>
            </div>
            <div className="panel-content">
              <div className="settings-group">
                <label>Select Student to Monitor</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="input-key select-custom"
                >
                  <option value="">-- Select Active Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.assignedTutorId ? "🎯" : ""}</option>
                  ))}
                </select>
              </div>

              {activeSelectedStudent ? (
                <div className="dashboard-content monitor-card">
                  <div className="student-profile-header">
                    <div>
                      <h2>{activeSelectedStudent.name}</h2>
                      <span className="tutor-assigned-tag">
                        🎯 Tutor: {tutors.find(t => t.id === activeSelectedStudent.assignedTutorId)?.name || "Unassigned"}
                      </span>
                    </div>
                    <div className="quiz-score-circle">
                      <div className="score-val">{activeSelectedStudent.quizScore || 0}%</div>
                      <div className="score-lbl">Quiz Score</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="dashboard-progress-section">
                    {(() => {
                      const tutorObj = tutors.find(t => t.id === activeSelectedStudent.assignedTutorId);
                      const steps = tutorObj ? tutorObj.lessonPlan : [];
                      const stepIdx = activeSelectedStudent.currentStepIndex || 0;
                      const percent = steps.length > 0 ? Math.min(100, Math.round(((stepIdx + 1) / steps.length) * 100)) : 0;
                      return (
                        <>
                          <div className="progress-labels">
                            <span>Lesson Checklist</span>
                            <span>Step {stepIdx + 1} of {steps.length}</span>
                          </div>
                          <div className="progress-track-bg">
                            <div className="progress-fill" style={{ width: `${percent}%` }} />
                          </div>
                          <p className="active-step-hint">
                            <strong>Active Step:</strong> {steps[stepIdx] || "Not Started"}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Gaps */}
                  <div className="diagnostics-card">
                    <h3>⚠️ Diagnosed Learning Gaps</h3>
                    {!activeSelectedStudent.gaps || activeSelectedStudent.gaps.length === 0 ? (
                      <p className="no-data-text">कोई कमजोरी अभी रिपोर्ट नहीं की गई है।</p>
                    ) : (
                      <div className="badges-container">
                        {activeSelectedStudent.gaps.map((gap, i) => (
                          <span key={i} className="badge gap-badge">🔍 {gap}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="diagnostics-card">
                    <h3>✅ Mastered Strengths</h3>
                    {!activeSelectedStudent.strengths || activeSelectedStudent.strengths.length === 0 ? (
                      <p className="no-data-text">कोई ताकत अभी रिपोर्ट नहीं की गई है।</p>
                    ) : (
                      <div className="badges-container">
                        {activeSelectedStudent.strengths.map((str, i) => (
                          <span key={i} className="badge strength-badge">⚡ {str}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="diagnostics-card flex-grow-card">
                    <h3>📝 Summary Diagnostics Report</h3>
                    <div className="summary-text-box">
                      {activeSelectedStudent.diagnostics || "रिपोर्ट अभी खाली है।"}
                    </div>
                  </div>

                  <button 
                    className="btn-connect" 
                    onClick={() => exportCoordinatorStudentReport(activeSelectedStudent)}
                  >
                    📥 Save & Export Diagnostic Report
                  </button>
                  <button 
                    className="btn-connect disconnect" 
                    style={{ marginTop: "0.5rem" }}
                    onClick={() => handleResetStudentProgress(activeSelectedStudent.id)}
                  >
                    🔄 Reset Progress & Lesson
                  </button>
                </div>
              ) : (
                <div className="dashboard-empty-state">
                  <span style={{ fontSize: "3rem" }}>📊</span>
                  <p>चयनित छात्र का लाइव स्कोर, पाठ योजना प्रगति, कमजोरी और ताकतों का रिपोर्ट देखने के लिए छात्र का चयन करें।</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 3. Student Portal (/student)
  if (route === "/student") {
    // 3A. Selector view: If studentId is not specified
    if (!activeStudentId) {
      return (
        <div className="app-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="student-select-container glass-panel glow">
            <div className="panel-header" style={{ justifyContent: "center" }}>
              <h2>🎓 Hazratganj Student Classroom Gate</h2>
            </div>
            <div className="panel-content select-panel-content">
              <p>कक्षा में प्रवेश करने के लिए अपना नाम चुनें:</p>
              {students.length === 0 ? (
                <div className="no-data-text" style={{ padding: "2rem" }}>
                  कोई छात्र अभी तक पंजीकृत नहीं है। कृपया पहले कोऑर्डिनेटर से संपर्क करें।
                </div>
              ) : (
                <div className="student-select-grid">
                  {students.map(s => {
                    const assignedTutorObj = tutors.find(t => t.id === s.assignedTutorId);
                    return (
                      <div 
                        key={s.id} 
                        className="student-select-card"
                        onClick={() => navigateTo(`/student?studentId=${s.id}`)}
                      >
                        <span className="card-avatar">👤</span>
                        <h3>{s.name}</h3>
                        <p className="card-meta">
                          {assignedTutorObj ? `📖 Assigned: ${assignedTutorObj.name}` : "⏱️ Waiting for Tutor Assignment"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
              <button className="btn-back-home" onClick={() => navigateTo("/")} style={{ marginTop: "1.5rem" }}>
                🔙 Hub Landing Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 3B. Classroom view: If studentId is specified
    if (!activeStudent) {
      return (
        <div className="app-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <div className="glass-panel" style={{ width: "400px", padding: "2rem", textAlign: "center" }}>
            <span style={{ fontSize: "3rem" }}>⏱️</span>
            <h3>लोड हो रहा है...</h3>
            <p>विद्यार्थी रिकॉर्ड प्राप्त किया जा रहा है।</p>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container">
        <header className="app-header">
          <div>
            <h1 className="clickable-title" onClick={() => navigateTo("/")}>🎓 Vernacular Student Classroom</h1>
            <p>अवधी / हिंदी ट्यूटर हब — संवादात्मक भौतिकी पाठशाला</p>
          </div>
          
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <button className="btn-back-home" onClick={() => navigateTo("/student")}>
              🔙 Switch Student
            </button>
            <div className="status-badge">
              <div className={`status-dot ${connected ? "connected" : connecting ? "connecting" : ""}`} />
              {connected ? "लाइव कक्षा" : connecting ? "कनेक्ट हो रहा है..." : "क्लास बंद है"}
            </div>
          </div>
        </header>

        {error && <div className="alert-error">⚠️ {error}</div>}

        <main className="main-grid">
          {/* Left Column: Student Voice Panel */}
          <section className="glass-panel glow">
            <div className="panel-header">
              <h2>🗣️ Tutor: {assignedTutor ? assignedTutor.name : "ट्यूटर असाइन नहीं है"}</h2>
            </div>

            <div className="panel-content">
              {/* Settings / Connection Controls */}
              {!connected ? (
                <div className="classroom-init-settings">
                  <div className="student-badge-info" style={{ marginBottom: "0.5rem" }}>
                    👤 विद्यार्थी का नाम: <strong>{activeStudent.name}</strong>
                  </div>
                  {assignedTutor ? (
                    <>
                      <div className="tutor-assigned-preview">
                        <p><strong>assigned tutor settings:</strong></p>
                        <ul>
                          <li>भाषा: {assignedTutor.dialect === "awadhi" ? "अवधी (Awadhi)" : assignedTutor.dialect === "hindi" ? "हिंदी" : "Adapt"}</li>
                          <li>गति: {assignedTutor.pace}</li>
                        </ul>
                      </div>
                      <div className="settings-row" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
                        <div className="settings-group half-width">
                          <label>Choose Dialect (बोली)</label>
                          <select className="input-key select-custom" value={activeDialect} onChange={(e) => setActiveDialect(e.target.value)}>
                            <option value="awadhi">Awadhi (अवधी)</option>
                            <option value="hindi">Hindi (हिंदी)</option>
                            <option value="auto">Auto-Adapt (स्वचालित)</option>
                          </select>
                        </div>
                        <div className="settings-group half-width">
                          <label>Choose Pace (गति)</label>
                          <select className="input-key select-custom" value={activePace} onChange={(e) => setActivePace(e.target.value)}>
                            <option value="slow">Slow (धीमी)</option>
                            <option value="normal">Normal (सामान्य)</option>
                            <option value="fast">Fast (तेज़)</option>
                          </select>
                        </div>
                      </div>
                      <button className="btn-connect" onClick={connectSession} disabled={connecting}>
                        {connecting ? "कनेक्ट हो रहा है..." : "ट्यूटर से जुड़ें (Start Classroom)"}
                      </button>
                      <button 
                        className="btn-connect disconnect" 
                        style={{ marginTop: "0.5rem", width: "100%" }}
                        onClick={() => handleResetStudentProgress(activeStudentId)}
                        disabled={connecting}
                      >
                        🔄 Reset Progress & Lesson (रीसेट प्रगति)
                      </button>
                    </>
                  ) : (
                    <div className="alert-error" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                      ⚠️ ट्यूटर असाइन नहीं है। कृपया कोऑर्डिनेटर हब में जाकर इस विद्यार्थी को ट्यूटर असाइन करें।
                    </div>
                  )}
                </div>
              ) : (
                <div className="connected-classroom-header">
                  <div className="student-badge-info">
                    👤 <strong>{activeStudent.name}</strong> | 🗣️ {activeDialect === "awadhi" ? "अवधी" : activeDialect === "hindi" ? "हिंदी" : "Auto-adapt"}
                  </div>
                  <button className="btn-connect disconnect" onClick={disconnectSession} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                    डिस्कनेक्ट (Close Session)
                  </button>
                </div>
              )}

              {/* Checklist Roadmap */}
              <div className="student-checklist-container">
                <h3>📖 Lesson Roadmap Checklist</h3>
                <div className="roadmap-checklist">
                  {activePlanSteps.length === 0 ? (
                    <p className="no-data-text">कोई पाठ चरण असाइन नहीं किया गया है।</p>
                  ) : (
                    activePlanSteps.map((step, idx) => {
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
                    })
                  )}
                </div>

                {connected && (
                  <div className="quick-actions-bar">
                    <button type="button" className="btn-quick-action proceed" onClick={triggerNextStep}>
                      आगे बढ़ें (Next Step) 👉
                    </button>
                    <button type="button" className="btn-quick-action quiz" onClick={triggerQuiz}>
                      📝 Take Quiz
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar Wave animation */}
              <div className="avatar-container">
                <div className={`avatar-outer ${connected ? "active" : ""}`}>
                  <div className="visualizer-rings" />
                  <div className={`avatar-core ${isRecording ? "recording" : connected ? "speaking" : ""}`}>
                    <div className="avatar-icon-glow" />
                    <span style={{ fontSize: "2rem" }}>🪐</span>
                  </div>
                </div>
                {connected && (
                  <div className="speech-waves">
                    <span style={{ animationPlayState: isRecording || connected ? "running" : "paused" }} />
                    <span style={{ animationPlayState: isRecording || connected ? "running" : "paused" }} />
                    <span style={{ animationPlayState: isRecording || connected ? "running" : "paused" }} />
                    <span style={{ animationPlayState: isRecording || connected ? "running" : "paused" }} />
                    <span style={{ animationPlayState: isRecording || connected ? "running" : "paused" }} />
                  </div>
                )}
              </div>

              {/* Transcript subtitles */}
              <div className="transcript-panel">
                <h3>संवाद विवरण (Transcript)</h3>
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

              {/* Mic Controls */}
              <div className="mic-controls">
                <button
                  className={`btn-mic ${isRecording ? "recording" : ""}`}
                  onClick={toggleRecording}
                  disabled={!connected}
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

              {/* Text Input fallback */}
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

          {/* Right Column: Blackboard visuals */}
          <section className="glass-panel">
            <div className="panel-header" style={{ background: "#05050e" }}>
              <h2>
                {activeQuiz 
                  ? "✍️ Interactive Quiz (प्रश्नोत्तरी)" 
                  : `📋 Blackboard: ${visualCode ? visualCode.title : "इंटरेक्टिव बोर्ड"}`
                }
              </h2>
            </div>
            
            {activeQuiz ? (
              <div className="quiz-card-box">
                <div className="quiz-question-container">
                  <span className="quiz-icon">❓</span>
                  <p className="quiz-question-text">{activeQuiz.question}</p>
                </div>
                
                <div className="quiz-options-list">
                  {activeQuiz.options.map((option, idx) => {
                    const isSelected = activeQuiz.selectedOptionIndex === idx;
                    const isCorrect = idx === activeQuiz.correctOptionIndex;
                    let btnClass = "quiz-option-btn";
                    
                    if (activeQuiz.submitted) {
                      if (isCorrect) {
                        btnClass += " correct-option";
                      } else if (isSelected) {
                        btnClass += " incorrect-option";
                      } else {
                        btnClass += " disabled-option";
                      }
                    } else if (isSelected) {
                      btnClass += " selected-option";
                    }
                    
                    return (
                      <button
                        key={idx}
                        className={btnClass}
                        disabled={activeQuiz.submitted}
                        onClick={() => handleSelectQuizOption(idx)}
                      >
                        <span className="option-letter">{String.fromCharCode(65 + idx)}.</span>
                        <span className="option-text">{option}</span>
                        {activeQuiz.submitted && isCorrect && <span className="feedback-icon">✅</span>}
                        {activeQuiz.submitted && isSelected && !isCorrect && <span className="feedback-icon">❌</span>}
                      </button>
                    );
                  })}
                </div>
                
                {activeQuiz.submitted && (
                  <div className="quiz-feedback-box animate-fade-in">
                    <p className={`quiz-feedback-status ${activeQuiz.selectedOptionIndex === activeQuiz.correctOptionIndex ? "status-success" : "status-error"}`}>
                      {activeQuiz.selectedOptionIndex === activeQuiz.correctOptionIndex 
                        ? "🎉 बिल्कुल सही उत्तर! (Correct)" 
                        : "⚠️ गलत उत्तर! (Incorrect)"
                      }
                    </p>
                    <p className="quiz-explanation-text">
                      <strong>स्पष्टीकरण:</strong> {activeQuiz.explanation}
                    </p>
                    <button 
                      className="btn-connect" 
                      style={{ marginTop: "1rem", alignSelf: "flex-end" }}
                      onClick={() => setActiveQuiz(null)}
                    >
                      🔙 Back to Blackboard
                    </button>
                  </div>
                )}
              </div>
            ) : visualCode ? (
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
          <button className="btn-debug-toggle" onClick={() => setShowDebug(!showDebug)}>
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
                <button className="btn-clear-debug" style={{ borderColor: "var(--accent-secondary)", color: "#a5f3fc" }} onClick={() => saveLogsToFile(debugLogs)} disabled={debugLogs.length === 0}>
                  💾 Save Logs
                </button>
                <button className="btn-clear-debug" style={{ borderColor: "var(--accent-primary)", color: "#93c5fd" }} onClick={downloadLogs} disabled={debugLogs.length === 0}>
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

  // Fallback / Routing Error: Render simple error gateway
  return (
    <div className="app-container" style={{ justifyContent: "center", alignItems: "center" }}>
      <div className="glass-panel" style={{ width: "400px", padding: "2rem", textAlign: "center" }}>
        <h2>⚠️ Page Not Found</h2>
        <p>The path <code>{route}</code> is unrecognized.</p>
        <button className="btn-connect" onClick={() => navigateTo("/")}>
          Return to Gateway Hub
        </button>
      </div>
    </div>
  );
}
