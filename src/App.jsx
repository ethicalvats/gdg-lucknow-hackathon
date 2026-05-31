import { useState, useEffect, useRef } from "react";
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

const defaultLessonPlans = {
  Physics: [
    "विराम और जड़त्व (Inertia) के नियम का परिचय",
    "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
    "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ],
  Chemistry: [
    "परमाणु संरचना (Atomic Structure) और इलेक्ट्रॉन व्यवस्था का परिचय",
    "रासायनिक बंध (Chemical Bonding) का सिद्धांत और चित्र",
    "अम्ल, क्षार और लवण (Acids, Bases & Salts) का महत्व",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ],
  Mathematics: [
    "त्रिकोणमिति (Trigonometry) के मूल सिद्धांत और सूत्र",
    "द्विघात समीकरण (Quadratic Equations) का ज्यामितीय चित्रण",
    "अवकलन (Calculus/Differentiation) का महत्व",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ],
  Biology: [
    "कोशिका संरचना (Cell Structure) और उसके अंग",
    "पाचन तंत्र (Digestive System) की कार्यविधि चित्र के साथ",
    "आनुवंशिकी (Genetics) और मेंडल के नियम",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ],
  English: [
    "Tenses (काल) के नियम और उदाहरण",
    "Active and Passive Voice का प्रयोग",
    "Direct and Indirect Speech के बदलाव",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा अभ्यास"
  ],
  Generic: [
    "विषय के मूल सिद्धांतों का परिचय",
    "चित्रों और उदाहरणों के साथ विस्तृत व्याख्या",
    "विषय के अनुप्रयोग और महत्व",
    "परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ]
};

export default function App() {
  // Routing State (Simple SPA Pathname and Query parsing)
  const [route, setRoute] = useState(window.location.pathname);
  const [searchQuery, setSearchQuery] = useState(window.location.search);
  const [saveStatus, setSaveStatus] = useState("");
  const [error, setError] = useState(null);
  const [coordinatorActiveTab, setCoordinatorActiveTab] = useState("dashboard");
  const [syllabusCollapsed, setSyllabusCollapsed] = useState(false);

  function logDebug(direction, type, data) {
    const time = new Date().toLocaleTimeString();
    // eslint-disable-next-line react-hooks/purity
    const id = Math.random().toString(36).substring(2, 9);
    const sanitizedData = typeof data === "object" ? JSON.stringify(sanitizeForLog(data), null, 2) : String(data);
    setDebugLogs((prev) => [
      { id, time, direction, type, data: sanitizedData },
      ...prev,
    ].slice(0, 50));
  }

  // Server state data
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState("");

  // Coordinator Forms State
  const [tutorName, setTutorName] = useState("");
  const [tutorInstructions, setTutorInstructions] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [board, setBoard] = useState("UP Board");
  const [lessonPlan, setLessonPlan] = useState([
    "विराम और जड़त्व (Inertia) के नियम का परिचय",
    "बल (Force) और त्वरण (Acceleration) का परिचय चित्र के साथ",
    "घर्षण (Friction) गुणांक का एनीमेशन और प्रभाव",
    "यूपी बोर्ड परीक्षा के प्रश्नों पर आधारित एक छोटा क्विज़"
  ]);
  const [defaultDialect, setDefaultDialect] = useState("awadhi");
  const [defaultPace, setDefaultPace] = useState("normal");
  const [newStepText, setNewStepText] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [liveInstructionText, setLiveInstructionText] = useState("");
  const [newStudentStepText, setNewStudentStepText] = useState("");

  // Student Active Session State
  const [activeStudent, setActiveStudent] = useState(null);
  const [assignedTutor, setAssignedTutor] = useState(null);
  const [activeDialect, setActiveDialect] = useState("awadhi");
  const [activePace, setActivePace] = useState("normal");
  const [studentActiveTab, setStudentActiveTab] = useState("classroom");

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
  const [isMuted, setIsMuted] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function sendTextMessage(text) {
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
  }

  const clearCoordinatorInstruction = async (studentId) => {
    try {
      await fetch("/api/students/clear-instruction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
    } catch (err) {
      console.error("Failed to clear coordinator instruction:", err);
    }
  };

  const fetchStudentDetail = async (studentId) => {
    try {
      const response = await fetch(`/api/student-detail?studentId=${studentId}`);
      const data = await response.json();
      if (data.success) {
        setActiveStudent(data.student);
        setAssignedTutor(data.tutor);
        setApiKey(data.apiKey || "");
        
        if (data.tutor) {
          // Priority: Student-specific tuned dialect/pace, then Tutor template defaults
          const currentDialect = data.student.dialect || data.tutor.dialect || "awadhi";
          const currentPace = data.student.pace || data.tutor.pace || "normal";
          
          setActiveDialect(currentDialect);
          setActivePace(currentPace);

          // Check for coordinator instruction injection
          if (data.student.coordinatorInstruction && ws.current && ws.current.readyState === WebSocket.OPEN) {
            const instructionText = data.student.coordinatorInstruction;
            sendTextMessage(`[Coordinator Instruction: ${instructionText}]`);
            clearCoordinatorInstruction(studentId);
          }

          // Check for coordinator-triggered reset:
          if (data.student.currentStepIndex === 0 && (!data.student.gaps || data.student.gaps.length === 0) && (!data.student.strengths || data.student.strengths.length === 0) && data.student.quizScore === 0) {
            if (studentCurrentStep !== 0 || studentGaps.length !== 0 || studentStrengths.length !== 0 || studentQuizScore !== 0) {
              setStudentCurrentStep(0);
              setStudentGaps([]);
              setStudentStrengths([]);
              setStudentQuizScore(0);
              setStudentDiagnostics("प्रगति और पाठ योजना रीसेट की गई।");
              setActiveQuiz(null);
            }
          } else {
            setStudentCurrentStep(data.student.currentStepIndex || 0);
            setStudentGaps(data.student.gaps || []);
            setStudentStrengths(data.student.strengths || []);
            setStudentQuizScore(data.student.quizScore || 0);
            setStudentDiagnostics(data.student.diagnostics || "विद्यार्थी का प्रोफाइल अभी खाली है।");
          }
          
          // Dynamically set greeting transcript on first load when not connected
          if (!connected && transcript.length <= 1) {
            const dialectGreeting = currentDialect === "awadhi"
              ? "नमस्ते! हम तोहार अवधी AI Tutor अही।"
              : currentDialect === "bhojpuri"
              ? "प्रणाम! हम तोहार भोजपुरी AI Tutor अही।"
              : "नमस्ते! हम आपके हिंदी AI Tutor हैं।";
            
            const subjectTerm = data.student.subject || data.tutor.subject || "भौतिकी (Physics)";
            
            setTranscript([
              {
                sender: "tutor",
                text: `${dialectGreeting} हमसे ${subjectTerm} के बारे में पूछें, और हम तोहार संदेह दूर करब और blackboard पर चित्र बनाकर समझाइब।`,
              }
            ]);
          }
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
    let interval = null;
    if (route === "/student" && activeStudentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudentDetail(activeStudentId);
      interval = setInterval(() => {
        fetchStudentDetail(activeStudentId);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, searchQuery, activeStudentId]);



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
        const filename = result.filepath.replace(/^.*[\\/]/, '');
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

    const finalSubject = subject === "custom" ? customSubjectName.trim() : subject;
    const newTutor = {
      id: "tutor_" + Date.now(),
      name: tutorName.trim(),
      instructions: tutorInstructions.trim(),
      lessonPlan,
      dialect: defaultDialect,
      pace: defaultPace,
      subject: finalSubject || "Physics",
      board: board.trim() || "UP Board",
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
        setSubject("Physics");
        setCustomSubjectName("");
        setBoard("UP Board");
        setLessonPlan(defaultLessonPlans["Physics"]);
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

  const handleUpdateStudentLessonPlan = async (studentId, updatedPlan, updatedDialect = null, updatedPace = null) => {
    try {
      const response = await fetch("/api/students/update-lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          lessonPlan: updatedPlan,
          dialect: updatedDialect,
          pace: updatedPace
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSaveStatus("Student roadmap/settings updated!");
        setTimeout(() => setSaveStatus(""), 3000);
        fetchState();
      }
    } catch (err) {
      console.error("Failed to update student lesson plan:", err);
    }
  };

  const handleSendCoordinatorInstruction = async (studentId) => {
    if (!liveInstructionText.trim()) return;
    try {
      const response = await fetch("/api/students/coordinator-instruction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          instruction: liveInstructionText.trim()
        }),
      });
      const data = await response.json();
      if (data.success) {
        setLiveInstructionText("");
        setSaveStatus("Instruction queued for live session!");
        setTimeout(() => setSaveStatus(""), 3000);
        fetchState();
      }
    } catch (err) {
      console.error("Failed to send coordinator instruction:", err);
    }
  };

  const restoreDefaultLessonPlan = () => {
    const key = defaultLessonPlans[subject] ? subject : "Generic";
    setLessonPlan(defaultLessonPlans[key]);
  };

  const handleSubjectChange = (val) => {
    setSubject(val);
    if (val !== "custom") {
      const key = defaultLessonPlans[val] ? val : "Generic";
      setLessonPlan(defaultLessonPlans[key]);
    }
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

    let newScore;
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
- **Selected Dialect:** ${activeDialect === "awadhi" ? "Awadhi (अवधी)" : activeDialect === "bhojpuri" ? "Bhojpuri (भोजपुरी)" : activeDialect === "hindi" ? "Hindi (हिंदी)" : "Auto-Adapt"}
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
        const filename = result.filepath.replace(/^.*[\\/]/, '');
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
        const filename = result.filepath.replace(/^.*[\\/]/, '');
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
      // eslint-disable-next-line react-hooks/immutability
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        console.log("WebSocket connected to Gemini Live API");

        // Format dialect and pace instructions dynamically
        const dialectInstructions = activeDialect === "awadhi"
          ? "Speak entirely in the Lucknowi Awadhi dialect. Use correct Awadhi pronouns and verb endings: " +
            "use 'हमार' (hamaar) or 'मोर' (mor) for 'my/our', 'तोर' (tor) or 'तोहार' (tohar) for 'your', 'अहै' (ahai) for 'is', 'अहईं' (ahain) for 'are/am', 'रहा' (raha) for 'was', and 'करत अहै' (karat ahai) for 'doing'. " +
            "Greet with polite Lucknowi style like 'का हाल अहै?' or 'का करत अहा भैया?'. " +
            "CRITICAL: Do NOT use Bhojpuri/Purabiya markers like 'बा' (ba), 'बानी' (baani), or 'का हाल बा' (this is Bhojpuri, not Awadhi). Keep it strictly Awadhi."
          : activeDialect === "bhojpuri"
          ? "Speak entirely in the Bhojpuri/Purabiya dialect. Use correct Bhojpuri pronouns and verb endings: " +
            "use 'रउआ' (raua) for 'you' (polite), 'तोहार' (tohar) or 'हमार' (hamaar), 'बा' (ba) for 'is', 'बानी' (baani) for 'am/are', 'बाड़े' (baade) for 'is/are' (polite), and 'करत बानी' (karat baani) for 'doing'. " +
            "Greet with 'का हाल बा?' or 'का करत बानी?'. " +
            "CRITICAL: Do NOT use Awadhi markers like 'अहै' (ahai), 'अहईं' (ahain), or 'का हाल-चाल अहै?'. Keep it strictly Bhojpuri."
          : activeDialect === "hindi"
          ? `Speak in standard Hindi suitable for ${assignedTutor.board || "UP Board"} students, using clear explanations and standard state board curriculum terminology.`
          : "Start in standard Hindi, but dynamically adapt your language to the student's dialect (Awadhi, Bhojpuri, or Hindi) and speech patterns as they talk. Stick to regional UP dialects.";

        const paceInstructions = activePace === "slow"
          ? "Speak at a slow, comfortable pace, pausing between main ideas to allow the student to digest the concepts."
          : activePace === "fast"
          ? "Speak at a quick, energetic pace, keeping explanations brief and highly dynamic."
          : "Speak at a normal, natural conversational pace.";

        // Format custom lesson plan steps list
        const lessonStepsStr = assignedTutor.lessonPlan.map((step, idx) => `${idx + 1}. ${step}`).join("\n");

        // Dynamic system prompt incorporating coordinator settings
        const systemPrompt = 
          `You are a helpful, warm, expert vernacular AI ${assignedTutor.subject || "physics"} tutor named "${assignedTutor.name}" for ${assignedTutor.board || "UP Board"} students in the UP region.\n` +
          `Your goal is to teach UP Board students ${assignedTutor.subject || "physics"} concepts following a custom lesson plan defined by their coordinator.\n\n` +
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
          `- Your explanations of ${assignedTutor.subject || "physics"} concepts must be accompanied by visuals. Call the tool 'explain_with_visuals' to draw interactive Canvas/SVG animations on the Blackboard. You MUST use the preloaded standard CSS classes in the HTML output:\n` +
          `  * A wrapping '<div class="canvas-container">' containing a '<canvas>' or '<svg>' element.\n` +
          `  * A '<div class="controls-panel">' container for inputs/controls.\n` +
          `  * A '<div class="slider-group">' enclosing a '<label>' with a '<span class="slider-val">' and an '<input type="range">'.\n` +
          `  * Interactive action buttons using '<button class="sim-btn">'.\n` +
          `  * A '<div class="explanation-card">' at the bottom for text descriptions in regional Hindi/Awadhi/Bhojpuri.\n` +
          `  * Avoid injecting custom <style> tags or custom layout CSS. Stick entirely to these pre-styled standard classes.\n` +
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
                            "HTML structure for the visual. Do not include style tags; instead use preloaded CSS classes: .canvas-container, .controls-panel, .slider-group (containing a label with span.slider-val, and input[type='range']), button.sim-btn, and .explanation-card.",
                        },
                        js: {
                          type: "STRING",
                          description:
                            "JavaScript animation logic and physics simulation. It should attach event listeners to control inputs (e.g. range sliders, restart buttons) and run a requestAnimationFrame loop to render physics updates. Update the .slider-val spans when sliders change. Do not use ES6 imports. Use plain browser JS APIs.",
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
                          description: "List of identified learning gaps, weaknesses, or misconceptions (e.g. ['Inertia concept confusion', 'Newton's 3rd law action-reaction sign error'])."
                        },
                        strengths: {
                          type: "ARRAY",
                          items: {
                            type: "STRING",
                          },
                          description: "List of concepts the student has mastered or answered correctly (e.g. ['Newton's 1st Law definition', 'Free-fall gravity visual understanding'])."
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
        // Auto-start live voice streaming immediately after session connects
        startMic();
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
    setIsMuted(false);

    if (player.current) {
      player.current.close();
      player.current = null;
    }

    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
      // eslint-disable-next-line react-hooks/immutability
      ws.current = null;
    }

    setConnected(false);
    setConnecting(false);
    setActiveQuiz(null);
  };

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // toggleRecording removed — live voice now uses startMic (auto-on connect) + toggleMute


  // ─── LIVE VOICE-TO-VOICE HELPERS ──────────────────────────────────────────────────
  // Auto-starts the mic and streams audio continuously to Gemini Live API.
  // Called immediately after the WebSocket setup message is sent.
  const startMic = async () => {
    if (recorder.current) return; // already running
    setError(null);
    recorder.current = new AudioRecorder((base64Audio) => {
      if (!recorder.current?._muted && ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: base64Audio } },
        }));
      }
    });
    try {
      await recorder.current.start();
      recorder.current._muted = false;
      setIsRecording(true);
      setIsMuted(false);
    } catch (err) {
      setError(`माइक्रोफ़ोन एक्सेस नहीं मिला: ${err.message}`);
      setIsRecording(false);
    }
  };

  // Mute/Unmute: silently pauses streaming without stopping the recorder.
  const toggleMute = () => {
    if (!connected || !recorder.current) return;
    const nowMuted = !isMuted;
    recorder.current._muted = nowMuted;
    setIsMuted(nowMuted);
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

  const activePlanSteps = activeStudent && activeStudent.lessonPlan && activeStudent.lessonPlan.length > 0
    ? activeStudent.lessonPlan
    : (assignedTutor ? assignedTutor.lessonPlan : []);
  const progressPercent = activePlanSteps.length > 0 
    ? Math.min(100, Math.round(((studentCurrentStep + 1) / activePlanSteps.length) * 100))
    : 0;

  // ROUTE RENDERING LOGIC
  
  // 1. Landing Gateway Page
  if (route === "/") {
    return (
      <div className="landing-container">
        <div className="ambient-glow glow-1"></div>
        <div className="ambient-glow glow-2"></div>
        <div className="ambient-glow glow-3"></div>
        <div className="landing-hero">
          <h1>📚 UP Regional AI Vernacular Tutor</h1>
          <p>Lucknow Hazratganj Coaching Hub — State Board Exams Gateway</p>
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
      <div className="app-container coordinator-page-container">
        <div className="coordinator-main-wrapper">
          {/* SIDEBAR NAVIGATION */}
          <aside className="coordinator-sidebar">
            <div className="sidebar-logo">
              <span className="logo-icon">🏫</span>
              <h2>Admin Hub</h2>
            </div>
            
            <nav className="sidebar-nav">
              <button 
                className={`sidebar-link ${coordinatorActiveTab === "dashboard" ? "active" : ""}`}
                onClick={() => setCoordinatorActiveTab("dashboard")}
              >
                🏠 Dashboard
              </button>
              <button 
                className={`sidebar-link ${coordinatorActiveTab === "tutors" ? "active" : ""}`}
                onClick={() => setCoordinatorActiveTab("tutors")}
              >
                👨‍🏫 Manage Tutors
              </button>
              <button 
                className={`sidebar-link ${coordinatorActiveTab === "students" ? "active" : ""}`}
                onClick={() => setCoordinatorActiveTab("students")}
              >
                👥 Student Roster
              </button>
              <button 
                className={`sidebar-link ${coordinatorActiveTab === "monitor" ? "active" : ""}`}
                onClick={() => setCoordinatorActiveTab("monitor")}
              >
                📈 Live Monitor
              </button>
            </nav>
            
            <div className="sidebar-footer">
              <button className="btn-back-home" style={{ width: "100%" }} onClick={() => navigateTo("/")}>
                🔙 Main Gateway
              </button>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="coordinator-content-area">
            <header className="app-header" style={{ marginBottom: "1.5rem" }}>
              <div>
                <h1 className="clickable-title" onClick={() => navigateTo("/")}>
                  🏫 Coordinator Hub: {coordinatorActiveTab.charAt(0).toUpperCase() + coordinatorActiveTab.slice(1)}
                </h1>
                <p>Vernacular AI Tutor Coordinator Command Center</p>
              </div>
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                {saveStatus && (
                  <span className="debug-badge received" style={{ background: "rgba(34, 197, 94, 0.2)", color: "#4ade80", fontSize: "0.8rem", textTransform: "none" }}>
                    {saveStatus}
                  </span>
                )}
              </div>
            </header>

            {error && <div className="alert-error">⚠️ {error}</div>}

            <main className="coordinator-tab-content">
              {/* 1. DASHBOARD OVERVIEW */}
              {coordinatorActiveTab === "dashboard" && (
                <div className="dashboard-overview-grid" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem" }}>
                    {/* Stats Cards */}
                    <div className="stat-card glass-panel" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="stat-icon" style={{ fontSize: "2.5rem" }}>👨‍🏫</span>
                      <div className="stat-info">
                        <h3 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>Tutor Templates</h3>
                        <p className="stat-number" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700 }}>{tutors.length}</p>
                      </div>
                    </div>

                    <div className="stat-card glass-panel" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="stat-icon" style={{ fontSize: "2.5rem" }}>👥</span>
                      <div className="stat-info">
                        <h3 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>Students</h3>
                        <p className="stat-number" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700 }}>{students.length}</p>
                      </div>
                    </div>

                    <div className="stat-card glass-panel" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="stat-icon" style={{ fontSize: "2.5rem" }}>⚡</span>
                      <div className="stat-info">
                        <h3 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>Active Paths</h3>
                        <p className="stat-number" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700 }}>{students.filter(s => s.assignedTutorId).length}</p>
                      </div>
                    </div>

                    <div className="stat-card glass-panel" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span className="stat-icon" style={{ fontSize: "2.5rem" }}>📊</span>
                      <div className="stat-info">
                        <h3 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>Average Score</h3>
                        <p className="stat-number" style={{ margin: 0, fontSize: "1.8rem", fontWeight: 700 }}>
                          {students.length > 0
                            ? Math.round(students.reduce((acc, s) => acc + s.quizScore, 0) / students.length)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary lists or visual greeting */}
                  <div className="dashboard-welcome-banner glass-panel" style={{ padding: "1.5rem", borderRadius: "12px" }}>
                    <h2 style={{ marginTop: 0 }}>Welcome to the Vernacular AI Admin Panel!</h2>
                    <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      Use the navigation sidebar to configure classroom templates, manage regional students, 
                      and monitor live dialect classrooms in real-time.
                    </p>
                    <div className="api-key-setup-box" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem", marginTop: "1rem" }}>
                      <label style={{ fontSize: "0.9rem", fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>Gemini API Key Setup:</label>
                      <input
                        type="password"
                        className="input-key"
                        placeholder={apiKey ? "•••••••••••••••• (Saved on Server)" : "Enter Gemini API Key..."}
                        onChange={(e) => handleSaveApiKey(e.target.value)}
                        style={{ width: "100%", maxWidth: "360px" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. MANAGE TUTORS */}
              {coordinatorActiveTab === "tutors" && (
                <div className="coordinator-tutors-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1.5rem" }}>
                  {/* Left Column: Tutors List */}
                  <div className="glass-panel" style={{ padding: "1.25rem" }}>
                    <div className="panel-header" style={{ borderBottom: "none", padding: "0 0 1rem 0" }}>
                      <h3 style={{ margin: 0 }}>Created Tutors ({tutors.length})</h3>
                    </div>
                    <div className="list-card-container">
                      {tutors.length === 0 ? (
                        <p className="no-data-text">कोई ट्यूटर नहीं बना है। नीचे नया ट्यूटर बनाएं।</p>
                      ) : (
                        tutors.map(t => (
                          <div key={t.id} className="crud-list-item">
                            <div className="crud-item-info">
                              <strong>{t.name}</strong>
                              <span>{t.subject || "Physics"} ({t.board || "UP Board"}) | {t.dialect === "awadhi" ? "अवधी" : t.dialect === "bhojpuri" ? "भोजपुरी" : "हिंदी"} | {t.pace}</span>
                            </div>
                            <button className="btn-crud-delete" onClick={() => handleDeleteTutor(t.id)}>❌</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Create Tutor Form */}
                  <div className="glass-panel" style={{ padding: "1.25rem" }}>
                    <form onSubmit={handleCreateTutor} className="tutor-create-form" style={{ marginTop: 0 }}>
                      <h3 style={{ marginTop: 0 }}>Create New Tutor Template</h3>
                      
                      <div className="settings-group">
                        <label>Tutor Name</label>
                        <input
                          type="text"
                          className="input-key"
                          placeholder="उदा. भौतिकी गुरु"
                          required
                          value={tutorName}
                          onChange={(e) => setTutorName(e.target.value)}
                        />
                      </div>

                      <div className="settings-row" style={{ gap: "0.5rem" }}>
                        <div className="settings-group half-width">
                          <label>Subject (विषय)</label>
                          <select className="input-key select-custom" value={subject} onChange={(e) => handleSubjectChange(e.target.value)}>
                            <option value="Physics">Physics (भौतिकी)</option>
                            <option value="Chemistry">Chemistry (रसायन शास्त्र)</option>
                            <option value="Mathematics">Mathematics (गणित)</option>
                            <option value="Biology">Biology (जीव विज्ञान)</option>
                            <option value="English">English (अंग्रेजी)</option>
                            <option value="custom">Other / Custom (अन्य)</option>
                          </select>
                        </div>
                        <div className="settings-group half-width">
                          <label>Target Board (standard)</label>
                          <input
                            type="text"
                            className="input-key"
                            placeholder="उदा. UP Board Class 11"
                            required
                            value={board}
                            onChange={(e) => setBoard(e.target.value)}
                          />
                        </div>
                      </div>

                      {subject === "custom" && (
                        <div className="settings-group">
                          <label>Custom Subject Name</label>
                          <input
                            type="text"
                            className="input-key"
                            placeholder="उदा. सामाजिक विज्ञान"
                            value={customSubjectName}
                            onChange={(e) => setCustomSubjectName(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="settings-group">
                        <label>Custom Instructions Persona Overlay</label>
                        <textarea
                          className="input-key text-area-instructions"
                          placeholder="उदा. 'उदार बनें, हजरतगंज गोमती नदी के उदाहरणों का प्रयोग करें...'"
                          rows="2"
                          value={tutorInstructions}
                          onChange={(e) => setTutorInstructions(e.target.value)}
                        />
                      </div>

                      <div className="settings-row" style={{ gap: "0.5rem" }}>
                        <div className="settings-group half-width">
                          <label>Dialect</label>
                          <select className="input-key select-custom" value={defaultDialect} onChange={(e) => setDefaultDialect(e.target.value)}>
                            <option value="awadhi">Awadhi (अवधी)</option>
                            <option value="bhojpuri">Bhojpuri (भोजपुरी)</option>
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
                          <button type="button" className="btn-add-step" onClick={handleAddStep}>➕</button>
                        </div>
                      </div>

                      <button type="submit" className="btn-connect" style={{ marginTop: "0.75rem", width: "100%" }}>
                        ➕ Create Tutor Template
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* 3. STUDENT ROSTER */}
              {coordinatorActiveTab === "students" && (
                <div className="master-detail-layout">
                  {/* Left Column: Master Students List */}
                  <div className="master-list-panel">
                    <div className="panel-header-minimal">
                      <h3>Students</h3>
                      <form onSubmit={handleCreateStudent} className="add-student-form-inline-minimal">
                        <input
                          type="text"
                          className="input-minimal"
                          style={{ width: "120px", display: "inline-block", marginRight: "0.25rem", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                          placeholder="Register student..."
                          required
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                        />
                        <button type="submit" className="btn-accent-minimal" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}>➕</button>
                      </form>
                    </div>
                    <div className="list-items-scrollable">
                      {students.length === 0 ? (
                        <p className="no-data-text-minimal">No students registered yet.</p>
                      ) : (
                        students.map(s => (
                          <div 
                            key={s.id} 
                            className={`list-item-row ${selectedStudentId === s.id ? "active" : ""}`}
                            onClick={() => setSelectedStudentId(s.id)}
                          >
                            <div className="item-row-info">
                              <strong>{s.name}</strong>
                              <span>{s.assignedTutorId ? tutors.find(t => t.id === s.assignedTutorId)?.name || "Assigned" : "No Tutor"}</span>
                            </div>
                            <button 
                              type="button"
                              className="btn-row-delete" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStudent(s.id);
                              }}
                            >
                              ❌
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Student Detail Customizer */}
                  <div className="detail-view-panel">
                    {activeSelectedStudent ? (
                      <div className="detail-form-minimal">
                        <h3 className="detail-header-title">Tune Roadmap: {activeSelectedStudent.name}</h3>
                        
                        <div className="settings-group-minimal">
                          <label>Assign Tutor Template</label>
                          <select
                            className="select-minimal"
                            value={activeSelectedStudent.assignedTutorId || ""}
                            onChange={(e) => handleAssignTutor(activeSelectedStudent.id, e.target.value)}
                          >
                            <option value="">-- No Tutor --</option>
                            {tutors.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.subject || "Physics"})</option>
                            ))}
                          </select>
                        </div>

                        <div className="settings-row-minimal">
                          <div className="settings-group-minimal half-width">
                            <label>Dialect Override</label>
                            <select 
                              className="select-minimal" 
                              value={activeSelectedStudent.dialect || "awadhi"} 
                              onChange={(e) => handleUpdateStudentLessonPlan(activeSelectedStudent.id, activeSelectedStudent.lessonPlan, e.target.value, activeSelectedStudent.pace)}
                            >
                              <option value="awadhi">Awadhi (अवधी)</option>
                              <option value="bhojpuri">Bhojpuri (भोजपुरी)</option>
                              <option value="hindi">Hindi (हिंदी)</option>
                              <option value="auto">Auto-Adapt</option>
                            </select>
                          </div>
                          <div className="settings-group-minimal half-width">
                            <label>Pace Override</label>
                            <select 
                              className="select-minimal" 
                              value={activeSelectedStudent.pace || "normal"} 
                              onChange={(e) => handleUpdateStudentLessonPlan(activeSelectedStudent.id, activeSelectedStudent.lessonPlan, activeSelectedStudent.dialect, e.target.value)}
                            >
                              <option value="slow">Slow</option>
                              <option value="normal">Normal</option>
                              <option value="fast">Fast</option>
                            </select>
                          </div>
                        </div>

                        <div className="settings-group-minimal lesson-builder-minimal">
                          <label>Custom Checklist Roadmap</label>
                          <div className="lesson-plan-list-minimal">
                            {(!activeSelectedStudent.lessonPlan || activeSelectedStudent.lessonPlan.length === 0) ? (
                              <p className="no-data-text-minimal">No custom lesson plan steps. Please assign a tutor first.</p>
                            ) : (
                              activeSelectedStudent.lessonPlan.map((step, idx) => (
                                <div key={idx} className="step-builder-item-minimal">
                                  <span className="step-num-minimal">{idx + 1}</span>
                                  <span className="step-text-minimal">{step}</span>
                                  <button 
                                    type="button" 
                                    className="btn-delete-step-minimal" 
                                    onClick={() => {
                                      const newPlan = activeSelectedStudent.lessonPlan.filter((_, i) => i !== idx);
                                      handleUpdateStudentLessonPlan(activeSelectedStudent.id, newPlan);
                                    }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="add-step-form-minimal">
                            <input
                              type="text"
                              className="input-minimal add-step-input"
                              placeholder="Add custom lesson step..."
                              value={newStudentStepText}
                              onChange={(e) => setNewStudentStepText(e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn-accent-minimal" 
                              onClick={() => {
                                if (newStudentStepText.trim()) {
                                  const newPlan = [...(activeSelectedStudent.lessonPlan || []), newStudentStepText.trim()];
                                  handleUpdateStudentLessonPlan(activeSelectedStudent.id, newPlan);
                                  setNewStudentStepText("");
                                }
                              }}
                            >
                              ➕ Add Step
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="detail-empty-minimal">
                        <span style={{ fontSize: "2.5rem" }}>👥</span>
                        <p>Select a student from the roster list on the left to customize settings and tune their learning roadmap.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. LIVE MONITORING */}
              {coordinatorActiveTab === "monitor" && (
                <div className="master-detail-layout">
                  {/* Left Column: Master Students Monitoring List */}
                  <div className="master-list-panel">
                    <div className="panel-header-minimal">
                      <h3>Monitored Students</h3>
                    </div>
                    <div className="list-items-scrollable">
                      {students.length === 0 ? (
                        <p className="no-data-text-minimal">No students available.</p>
                      ) : (
                        students.map(s => (
                          <div 
                            key={s.id} 
                            className={`list-item-row ${selectedStudentId === s.id ? "active" : ""}`}
                            onClick={() => setSelectedStudentId(s.id)}
                          >
                            <div className="item-row-info">
                              <strong>{s.name}</strong>
                              <span>{s.assignedTutorId ? tutors.find(t => t.id === s.assignedTutorId)?.name || "Assigned" : "No Tutor"}</span>
                            </div>
                            <span style={{ fontSize: "1.2rem" }}>🎯</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Live Details & Control */}
                  <div className="detail-view-panel">
                    {activeSelectedStudent ? (
                      <div className="detail-form-minimal">
                        <h3 className="detail-header-title">Live Session: {activeSelectedStudent.name}</h3>

                        {/* Checklist Progress */}
                        <div className="settings-group-minimal">
                          <div className="progress-labels" style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <span>Syllabus Completion</span>
                            <span>
                              {activeSelectedStudent.lessonPlan && activeSelectedStudent.lessonPlan.length > 0
                                ? Math.min(100, Math.round(((activeSelectedStudent.currentStepIndex || 0) + 1) / activeSelectedStudent.lessonPlan.length * 100))
                                : 0}%
                            </span>
                          </div>
                          <div className="progress-track-bg" style={{ background: "#e4e4e7", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "0.5rem" }}>
                            <div 
                              className="progress-fill" 
                              style={{ 
                                background: "#4f46e5",
                                height: "100%",
                                width: `${activeSelectedStudent.lessonPlan && activeSelectedStudent.lessonPlan.length > 0
                                  ? Math.min(100, Math.round(((activeSelectedStudent.currentStepIndex || 0) + 1) / activeSelectedStudent.lessonPlan.length * 100))
                                  : 0}%` 
                              }} 
                            />
                          </div>
                          <p className="active-step-hint" style={{ fontSize: "0.85rem", color: "#71717a", margin: 0 }}>
                            <strong>Active Step:</strong> {activeSelectedStudent.lessonPlan ? activeSelectedStudent.lessonPlan[activeSelectedStudent.currentStepIndex || 0] : "None"}
                          </p>
                        </div>

                        {/* Custom Checklist Roadmap */}
                        <div className="settings-group-minimal lesson-builder-minimal">
                          <label>Custom Checklist Roadmap</label>
                          <div className="lesson-plan-list-minimal">
                            {(!activeSelectedStudent.lessonPlan || activeSelectedStudent.lessonPlan.length === 0) ? (
                              <p className="no-data-text-minimal">No custom lesson plan steps. Please assign a tutor first.</p>
                            ) : (
                              activeSelectedStudent.lessonPlan.map((step, idx) => (
                                <div key={idx} className="step-builder-item-minimal">
                                  <span className="step-num-minimal">{idx + 1}</span>
                                  <span className="step-text-minimal">{step}</span>
                                  <button 
                                    type="button" 
                                    className="btn-delete-step-minimal" 
                                    onClick={() => {
                                      const newPlan = activeSelectedStudent.lessonPlan.filter((_, i) => i !== idx);
                                      handleUpdateStudentLessonPlan(activeSelectedStudent.id, newPlan);
                                    }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="add-step-form-minimal">
                            <input
                              type="text"
                              className="input-minimal add-step-input"
                              placeholder="Add custom lesson step..."
                              value={newStudentStepText}
                              onChange={(e) => setNewStudentStepText(e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn-accent-minimal" 
                              onClick={() => {
                                if (newStudentStepText.trim()) {
                                  const newPlan = [...(activeSelectedStudent.lessonPlan || []), newStudentStepText.trim()];
                                  handleUpdateStudentLessonPlan(activeSelectedStudent.id, newPlan);
                                  setNewStudentStepText("");
                                }
                              }}
                            >
                              ➕ Add Step
                            </button>
                          </div>
                        </div>

                        {/* Coordinator Live Prompt Note to Tutor */}
                        <div className="settings-group-minimal">
                          <label>Live Supervisor Note (AI Tutor prompt)</label>
                          <div className="add-step-form-minimal">
                            <input
                              type="text"
                              className="input-minimal"
                              placeholder="उदा. 'धीरे समझाइए', 'एक क्विज पूछिए'..."
                              value={liveInstructionText}
                              onChange={(e) => setLiveInstructionText(e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn-accent-minimal" 
                              onClick={() => handleSendCoordinatorInstruction(activeSelectedStudent.id)}
                            >
                              📣 Send
                            </button>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="settings-group-minimal diagnostics-card-minimal">
                          <label>📝 Summary Diagnostics Report</label>
                          <div className="summary-text-box-minimal" style={{ border: "1px solid #e4e4e7", padding: "0.75rem", borderRadius: "6px", background: "#f4f4f5", minHeight: "100px", maxHeight: "200px", overflowY: "auto", fontSize: "0.9rem" }}>
                            {activeSelectedStudent.diagnostics || "रिपोर्ट अभी खाली है।"}
                          </div>
                        </div>

                        <div className="action-buttons-minimal" style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                          <button 
                            type="button"
                            className="btn-accent-minimal" 
                            style={{ flexGrow: 1 }}
                            onClick={() => exportCoordinatorStudentReport(activeSelectedStudent)}
                          >
                            📥 Save & Export Diagnostic Report
                          </button>
                          <button 
                            type="button"
                            className="btn-danger-minimal" 
                            style={{ flexGrow: 1 }}
                            onClick={() => handleResetStudentProgress(activeSelectedStudent.id)}
                          >
                            🔄 Reset Progress & Lesson
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="detail-empty-minimal">
                        <span style={{ fontSize: "2.5rem" }}>📊</span>
                        <p>Select a student from the monitored list on the left to view diagnostics report, lesson roadmap, and send real-time supervisor notes.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
      </main>
      </div>
    </div>
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
              <h2>🎓 UP Vernacular Student Classroom Gate</h2>
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
            <p>{activeDialect === "awadhi" ? "अवधी" : activeDialect === "bhojpuri" ? "भोजपुरी" : "हिंदी"} AI {assignedTutor ? assignedTutor.subject : "विषय"} ट्यूटर हब — संवादात्मक पाठशाला</p>
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

        <div className="student-classroom-wrapper">
          {/* Left Panel: Collapsible Syllabus/Roadmap */}
          <aside className={`student-syllabus-panel ${syllabusCollapsed ? "collapsed" : ""}`}>
            <div className="syllabus-header">
              <h3>📖 Checklist ({progressPercent}%)</h3>
              <button 
                type="button"
                className="btn-collapse-syllabus" 
                onClick={() => setSyllabusCollapsed(!syllabusCollapsed)}
                title={syllabusCollapsed ? "Expand Syllabus" : "Collapse Syllabus"}
              >
                {syllabusCollapsed ? "➡️" : "⬅️"}
              </button>
            </div>
            
            {!syllabusCollapsed && (
              <div className="syllabus-content">
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
              </div>
            )}
          </aside>

          {/* Center Panel: Blackboard & Active Content */}
          <section className="student-center-panel">
            <div className="center-panel-header">
              <h2>
                {studentActiveTab === "analytics"
                  ? "📈 My Progress & Analytics"
                  : activeQuiz 
                    ? "✍️ Interactive Quiz (प्रश्नोत्तरी)" 
                    : `📋 Blackboard: ${visualCode ? visualCode.title : "इंटरेक्टिव बोर्ड"}`
                }
              </h2>
              <button 
                type="button"
                className="btn-analytics-toggle" 
                onClick={() => setStudentActiveTab(studentActiveTab === "analytics" ? "classroom" : "analytics")}
              >
                {studentActiveTab === "analytics" ? "📺 View Classroom" : "📈 View Progress"}
              </button>
            </div>

            <div className="center-panel-content">
              {studentActiveTab === "analytics" ? (
                <div className="analytics-tab-content" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* Progress Meter */}
                  <div className="dashboard-progress-section">
                    <div className="progress-labels">
                      <span>📖 Course Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="progress-track-bg">
                      <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="active-step-hint">
                      <strong>Current Step:</strong> {activePlanSteps[studentCurrentStep] || "None"}
                    </p>
                  </div>

                  {/* Score & performance grade */}
                  <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
                    {(() => {
                      let borderCol = "#06b6d4";
                      let textCol = "#06b6d4";
                      let shadowVal = "0 0 15px rgba(6, 182, 212, 0.3)";

                      if (studentQuizScore >= 80) {
                        borderCol = "#10b981";
                        textCol = "#10b981";
                        shadowVal = "0 0 15px rgba(16, 185, 129, 0.3)";
                      } else if (studentQuizScore < 50) {
                        borderCol = "#ef4444";
                        textCol = "#ef4444";
                        shadowVal = "0 0 15px rgba(239, 68, 68, 0.3)";
                      }

                      return (
                        <div 
                          className="quiz-score-circle" 
                          style={{ 
                            borderColor: borderCol,
                            boxShadow: shadowVal 
                          }}
                        >
                          <span className="score-val" style={{ color: textCol }}>{studentQuizScore}</span>
                          <span className="score-lbl">Quiz Score</span>
                        </div>
                      );
                    })()}

                    <div>
                      <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>
                        Status:{" "}
                        <span 
                          style={{ 
                            color: studentQuizScore >= 80 ? "#10b981" : studentQuizScore < 50 ? "#ef4444" : "#06b6d4",
                            fontWeight: "bold"
                          }}
                        >
                          {studentQuizScore >= 80 ? "Mastered (पूर्ण दक्षता)" : studentQuizScore < 50 ? "Needs Focus (विशेष ध्यान दें)" : "Progressing (प्रगति पर)"}
                        </span>
                      </h4>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        Based on your latest interactive quiz performance.
                      </p>
                    </div>
                  </div>

                  {/* Strengths & Gaps */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div className="diagnostics-card">
                      <h3>🟢 Mastered Strengths</h3>
                      {studentStrengths.length === 0 ? (
                        <p className="no-data-text">No concepts mastered yet.</p>
                      ) : (
                        <div className="badges-container">
                          {studentStrengths.map((str, idx) => (
                            <span key={idx} className="badge strength-badge">{str}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="diagnostics-card">
                      <h3>🔴 Learning Gaps</h3>
                      {studentGaps.length === 0 ? (
                        <p className="no-data-text">No gaps identified yet.</p>
                      ) : (
                        <div className="badges-container">
                          {studentGaps.map((gap, idx) => (
                            <span key={idx} className="badge gap-badge">{gap}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div className="diagnostics-card flex-grow-card">
                    <h3>💡 Personalized AI Recommendations</h3>
                    <div className="summary-text-box" style={{ maxHeight: "none" }}>
                      {studentDiagnostics || "Recommendations will generate once session starts."}
                    </div>
                  </div>
                </div>
              ) : (
                /* Blackboard active quiz or simulation */
                <div className="blackboard-workspace">
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
                              type="button"
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
                            type="button"
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
                      <p>ट्यूटर से {assignedTutor ? assignedTutor.subject : "विषय"} का कोई नियम पूछें। ट्यूटर समझाने के लिए यहाँ एक जीवंत एनीमेशन बनाएगा।</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Floating controls dock at the bottom of the Center Panel */}
            <div className="student-controls-dock">
              {!connected ? (
                <div className="classroom-init-settings glass-panel" style={{ width: "100%", padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
                    <div className="student-badge-info" style={{ fontSize: "0.95rem" }}>
                      👤 Student: <strong>{activeStudent.name}</strong>
                    </div>
                    {assignedTutor ? (
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div className="settings-group" style={{ margin: 0 }}>
                          <select className="input-key select-custom select-inline" value={activeDialect} onChange={(e) => setActiveDialect(e.target.value)}>
                            <option value="awadhi">Awadhi (अवधी)</option>
                            <option value="bhojpuri">Bhojpuri (भोजपुरी)</option>
                            <option value="hindi">Hindi (हिंदी)</option>
                            <option value="auto">Auto-Adapt</option>
                          </select>
                        </div>
                        <div className="settings-group" style={{ margin: 0 }}>
                          <select className="input-key select-custom select-inline" value={activePace} onChange={(e) => setActivePace(e.target.value)}>
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                          </select>
                        </div>
                        <button type="button" className="btn-connect" onClick={connectSession} disabled={connecting} style={{ padding: "0.5rem 1rem" }}>
                          {connecting ? "Connecting..." : "🚀 Start Classroom"}
                        </button>
                      </div>
                    ) : (
                      <span className="no-tutor-warn">⚠️ No Tutor Assigned</span>
                    )}
                  </div>
                </div>
              ) : (
                studentActiveTab !== "analytics" && (
                  <div className="dock-active-row">
                    {/* Live voice status indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: isMuted ? "#71717a" : "#10b981", fontWeight: 500 }}>
                      <span style={{
                        display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                        background: isMuted ? "#71717a" : "#10b981",
                        boxShadow: isMuted ? "none" : "0 0 6px #10b981",
                        animation: isMuted ? "none" : "pulseGlow 1.5s infinite"
                      }} />
                      {isMuted ? "🔇 माइक म्यूट — Unmute करके बोलें" : "🎤 लाइव सत्र जारी — सीधे बोलें"}
                    </div>

                    <div className="dock-actions">
                      <button
                        type="button"
                        className={`btn-quick-action ${isMuted ? "" : "proceed"}`}
                        onClick={toggleMute}
                        title={isMuted ? "Unmute microphone" : "Mute microphone"}
                        style={isMuted ? { background: "#fef2f2", color: "#ef4444", borderColor: "#fca5a5" } : {}}
                      >
                        {isMuted ? (
                          <><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ display: "inline", marginRight: "0.3rem" }}><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>Unmute Mic</>
                        ) : (
                          <><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style={{ display: "inline", marginRight: "0.3rem" }}><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>Mute Mic</>
                        )}
                      </button>
                      <button type="button" className="btn-quick-action proceed" onClick={triggerNextStep}>
                        आगे बढ़ें 👉
                      </button>
                      <button type="button" className="btn-quick-action" onClick={triggerQuiz}>
                        📝 Quiz
                      </button>
                    </div>

                    <div className="dock-mic-input-group">
                      <form onSubmit={handleSendText} className="dock-text-form">
                        <input
                          type="text"
                          className="input-key dock-text-input"
                          placeholder="या यहाँ टाइप करके पूछें..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                        />
                        <button type="submit" className="btn-send-dock">भेजें</button>
                      </form>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          {/* Right Panel: Conversation Feed & Avatar */}
          <aside className="student-interaction-panel">
            <div className="interaction-header">
              <h3>🗣️ AI Tutor</h3>
              {connected && (
                <button type="button" className="btn-close-session" onClick={disconnectSession}>
                  🔌 Close Session
                </button>
              )}
            </div>

            {/* Avatar Widget inside sidebar */}
            <div className="avatar-widget-container glass-panel">
              <div className="avatar-container">
                <div className={`avatar-outer ${connected ? "active" : ""}`}>
                  <div className="visualizer-rings" />
                  <div className={`avatar-core ${isRecording ? "recording" : connected ? "speaking" : ""}`}>
                    <div className="avatar-icon-glow" />
                    <span style={{ fontSize: "2.2rem" }}>🪐</span>
                  </div>
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
              
              <div className="tutor-name-label">
                <strong>{assignedTutor ? assignedTutor.name : "Vernacular AI Tutor"}</strong>
                <span className="dialect-badge">{activeDialect === "awadhi" ? "अवधी" : activeDialect === "bhojpuri" ? "भोजपुरी" : "हिंदी"}</span>
              </div>
            </div>

            {/* Conversational Transcript Feed */}
            <div className="transcript-panel">
              <h3>चर्चा इतिहास (Chat History)</h3>
              <div className="transcript-area">
                {transcript.map((msg, i) => (
                  <div key={i} className={`msg ${msg.sender}`}>
                    <span className="speaker-label">{msg.sender === "tutor" ? "🤖 Tutor" : "👤 You"}</span>
                    <p>{msg.text}</p>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </aside>
        </div>

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
