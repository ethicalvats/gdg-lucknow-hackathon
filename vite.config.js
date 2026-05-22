import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const stateDir = path.resolve(__dirname, 'server_state')
const tutorsFile = path.join(stateDir, 'tutors.json')
const studentsFile = path.join(stateDir, 'students.json')
const apiKeyFile = path.join(stateDir, 'api_key.txt')

const ensureStateDir = () => {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir);
  }
};

const readTutors = () => {
  ensureStateDir();
  if (!fs.existsSync(tutorsFile)) {
    fs.writeFileSync(tutorsFile, '[]', 'utf8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(tutorsFile, 'utf8'));
  } catch {
    return [];
  }
};

const writeTutors = (tutors) => {
  ensureStateDir();
  fs.writeFileSync(tutorsFile, JSON.stringify(tutors, null, 2), 'utf8');
};

const readStudents = () => {
  ensureStateDir();
  if (!fs.existsSync(studentsFile)) {
    fs.writeFileSync(studentsFile, '[]', 'utf8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(studentsFile, 'utf8'));
  } catch {
    return [];
  }
};

const writeStudents = (students) => {
  ensureStateDir();
  fs.writeFileSync(studentsFile, JSON.stringify(students, null, 2), 'utf8');
};

const readApiKey = () => {
  ensureStateDir();
  if (!fs.existsSync(apiKeyFile)) {
    return '';
  }
  return fs.readFileSync(apiKeyFile, 'utf8').trim();
};

const writeApiKey = (key) => {
  ensureStateDir();
  fs.writeFileSync(apiKeyFile, key.trim(), 'utf8');
};

const readBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', err => {
      reject(err);
    });
  });
};

const sendJSON = (res, data, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'server-state-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const pathname = parsedUrl.pathname;

          try {
            if (pathname === '/api/state' && req.method === 'GET') {
              sendJSON(res, { tutors: readTutors(), students: readStudents(), apiKey: readApiKey() });
            } 
            else if (pathname === '/api/save-api-key' && req.method === 'POST') {
              const body = await readBody(req);
              const { apiKey } = JSON.parse(body);
              writeApiKey(apiKey);
              sendJSON(res, { success: true });
            }
            else if (pathname === '/api/tutors' && req.method === 'POST') {
              const body = await readBody(req);
              const tutor = JSON.parse(body);
              const tutors = readTutors();
              
              const existingIdx = tutors.findIndex(t => t.id === tutor.id);
              if (existingIdx > -1) {
                tutors[existingIdx] = tutor;
              } else {
                tutors.push(tutor);
              }
              writeTutors(tutors);
              sendJSON(res, { success: true, tutors });
            } 
            else if (pathname === '/api/tutors/delete' && req.method === 'POST') {
              const body = await readBody(req);
              const { tutorId } = JSON.parse(body);
              let tutors = readTutors();
              tutors = tutors.filter(t => t.id !== tutorId);
              writeTutors(tutors);
              sendJSON(res, { success: true, tutors });
            } 
            else if (pathname === '/api/students' && req.method === 'POST') {
              const body = await readBody(req);
              const student = JSON.parse(body);
              const students = readStudents();

              const existingIdx = students.findIndex(s => s.id === student.id);
              if (existingIdx > -1) {
                students[existingIdx] = student;
              } else {
                students.push(student);
              }
              writeStudents(students);
              sendJSON(res, { success: true, students });
            } 
            else if (pathname === '/api/students/delete' && req.method === 'POST') {
              const body = await readBody(req);
              const { studentId } = JSON.parse(body);
              let students = readStudents();
              students = students.filter(s => s.id !== studentId);
              writeStudents(students);
              sendJSON(res, { success: true, students });
            } 
            else if (pathname === '/api/assign-tutor' && req.method === 'POST') {
              const body = await readBody(req);
              const { studentId, tutorId } = JSON.parse(body);
              const students = readStudents();
              const studentIdx = students.findIndex(s => s.id === studentId);
              if (studentIdx > -1) {
                students[studentIdx].assignedTutorId = tutorId;
                writeStudents(students);
                sendJSON(res, { success: true });
              } else {
                sendJSON(res, { success: false, error: 'Student not found' }, 440);
              }
            } 
            else if (pathname === '/api/update-student-diagnostics' && req.method === 'POST') {
              const body = await readBody(req);
              const { studentId, gaps, strengths, quizScore, diagnostics, currentStepIndex } = JSON.parse(body);
              const students = readStudents();
              const studentIdx = students.findIndex(s => s.id === studentId);
              if (studentIdx > -1) {
                if (Array.isArray(gaps)) students[studentIdx].gaps = gaps;
                if (Array.isArray(strengths)) students[studentIdx].strengths = strengths;
                if (typeof quizScore === 'number') students[studentIdx].quizScore = quizScore;
                if (typeof diagnostics === 'string') students[studentIdx].diagnostics = diagnostics;
                if (typeof currentStepIndex === 'number') students[studentIdx].currentStepIndex = currentStepIndex;
                
                writeStudents(students);
                sendJSON(res, { success: true });
              } else {
                sendJSON(res, { success: false, error: 'Student not found' }, 404);
              }
            } 
            else if (pathname === '/api/student-detail' && req.method === 'GET') {
              const studentId = parsedUrl.searchParams.get('studentId');
              const students = readStudents();
              const student = students.find(s => s.id === studentId);
              if (student) {
                const tutors = readTutors();
                const tutor = tutors.find(t => t.id === student.assignedTutorId) || null;
                const apiKey = readApiKey();
                sendJSON(res, { success: true, student, tutor, apiKey });
              } else {
                sendJSON(res, { success: false, error: 'Student not found' }, 404);
              }
            } 
            else if (pathname === '/api/save-logs' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const logsDir = path.resolve(__dirname, 'logs');
                if (!fs.existsSync(logsDir)) {
                  fs.mkdirSync(logsDir);
                }
                const filename = `gemini_live_logs_${Date.now()}.json`;
                const filePath = path.join(logsDir, filename);
                fs.writeFileSync(filePath, body, 'utf8');
                sendJSON(res, { success: true, filepath: filePath });
              } catch (err) {
                sendJSON(res, { success: false, error: err.message }, 500);
              }
            } 
            else if (pathname === '/api/save-report' && req.method === 'POST') {
              const body = await readBody(req);
              try {
                const reportsDir = path.resolve(__dirname, 'reports');
                if (!fs.existsSync(reportsDir)) {
                  fs.mkdirSync(reportsDir);
                }
                const filename = `student_diagnostic_${Date.now()}.md`;
                const filePath = path.join(reportsDir, filename);
                fs.writeFileSync(filePath, body, 'utf8');
                sendJSON(res, { success: true, filepath: filePath });
              } catch (err) {
                sendJSON(res, { success: false, error: err.message }, 500);
              }
            } 
            else {
              next();
            }
          } catch (err) {
            console.error("Middleware API error:", err);
            sendJSON(res, { success: false, error: err.message }, 500);
          }
        });
      }
    }
  ],
})
