import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'save-logs-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/save-logs' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const logsDir = path.resolve(__dirname, 'logs');
                if (!fs.existsSync(logsDir)) {
                  fs.mkdirSync(logsDir);
                }
                const filename = `gemini_live_logs_${Date.now()}.json`;
                const filePath = path.join(logsDir, filename);
                fs.writeFileSync(filePath, body, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filepath: filePath }));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else if (req.url === '/api/save-report' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const reportsDir = path.resolve(__dirname, 'reports');
                if (!fs.existsSync(reportsDir)) {
                  fs.mkdirSync(reportsDir);
                }
                const filename = `student_diagnostic_${Date.now()}.md`;
                const filePath = path.join(reportsDir, filename);
                fs.writeFileSync(filePath, body, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filepath: filePath }));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
})

