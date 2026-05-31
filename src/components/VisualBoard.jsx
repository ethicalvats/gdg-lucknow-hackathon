export default function VisualBoard({ visualCode }) {
  if (!visualCode) return null;

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; }
        html, body {
          margin: 0; padding: 0;
          width: 100%; height: 100%;
          background-color: #05050e;
          color: #f3f4f6;
          font-family: system-ui, -apple-system, sans-serif;
        }
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          overflow-x: hidden;
          overflow-y: auto;
          min-height: 100vh;
        }
        /* Common blackboard UI classes */
        .canvas-container {
          position: relative;
          width: 100%;
          max-width: 900px;
          aspect-ratio: 16/9;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        canvas {
          display: block;
          width: 100%;
          height: 100%;
          background: #080816;
        }
        .controls-panel {
          margin-top: 1rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 0.85rem 1rem;
          border-radius: 8px;
          width: 100%;
          max-width: 900px;
          font-size: 0.88rem;
          backdrop-filter: blur(8px);
        }
        .slider-group {
          flex: 1 1 200px;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .slider-group label {
          color: #9ca3af;
          font-weight: 500;
          display: flex;
          justify-content: space-between;
        }
        .slider-val { font-family: monospace; color: #06b6d4; }
        input[type="range"] {
          width: 100%;
          accent-color: #a855f7;
          height: 6px;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168,85,247,0.5);
        }
        button.sim-btn {
          background: linear-gradient(135deg,#a855f7,#7c3aed);
          border: none;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        button.sim-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .explanation-card {
          margin-top: 0.75rem;
          background: rgba(168,85,247,0.05);
          border: 1px solid rgba(168,85,247,0.15);
          border-radius: 8px;
          padding: 0.7rem 1rem;
          width: 100%;
          max-width: 900px;
          font-size: 0.9rem;
          line-height: 1.5;
          color: #e9d5ff;
        }
      </style>
    </head>
    <body>
      ${visualCode.html}
      <script>
        try {
          ${visualCode.js}
        } catch (err) {
          console.error("Visual script error:", err);
          const d = document.createElement("div");
          d.style.cssText = "color:#ef4444;margin-top:1rem;font-family:monospace;background:rgba(239,68,68,0.1);padding:.75rem;border:1px solid rgba(239,68,68,0.2);border-radius:6px;";
          d.innerHTML = "<strong>Script Error:</strong> " + err.message;
          document.body.appendChild(d);
        }
      </script>
    </body>
    </html>
  `;

  return (
    <div className="blackboard-container">
      <iframe
        title="Dynamic Blackboard"
        className="blackboard-frame"
        srcDoc={fullHtml}
        sandbox="allow-scripts"
        style={{ width: "100%", height: "100%", border: "none", display: "block", flexGrow: 1 }}
      />
    </div>
  );
}
