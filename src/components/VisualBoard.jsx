import React from "react";

export default function VisualBoard({ visualCode }) {
  if (!visualCode) return null;

  // We build a template that includes base styling so the animations look beautiful
  // and consistent in dark mode, but the AI-generated code will overwrite elements inside body
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 1.5rem;
          background-color: #05050e;
          color: #f3f4f6;
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: auto;
        }
        
        /* Common blackboard UI aesthetics */
        .canvas-container {
          position: relative;
          width: 100%;
          max-width: 600px;
          aspect-ratio: 16/9;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
        }
        
        canvas {
          display: block;
          width: 100%;
          height: 100%;
          background: #080816;
        }
        
        .controls-panel {
          margin-top: 1.25rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 1rem 1.25rem;
          border-radius: 8px;
          width: 100%;
          max-width: 600px;
          box-sizing: border-box;
          font-size: 0.9rem;
          backdrop-filter: blur(10px);
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
        
        .slider-val {
          font-family: monospace;
          color: #06b6d4;
        }
        
        input[type="range"] {
          width: 100%;
          accent-color: #a855f7;
          background: rgba(255,255,255,0.1);
          height: 6px;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168,85,247,0.5);
        }

        button.sim-btn {
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
          border: none;
          color: white;
          padding: 0.6rem 1.2rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
          font-family: inherit;
        }
        
        button.sim-btn:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
        }
        
        button.sim-btn:active {
          transform: translateY(0);
        }

        .explanation-card {
          margin-top: 1rem;
          background: rgba(168, 85, 247, 0.05);
          border: 1px solid rgba(168, 85, 247, 0.15);
          border-radius: 8px;
          padding: 0.8rem 1.2rem;
          width: 100%;
          max-width: 600px;
          box-sizing: border-box;
          font-size: 0.95rem;
          line-height: 1.5;
          color: #e9d5ff;
        }
      </style>
    </head>
    <body>
      ${visualCode.html}
      <script>
        // Run the custom AI-generated JavaScript block
        try {
          ${visualCode.js}
        } catch (err) {
          console.error("Error executing dynamically generated visual script:", err);
          const errorDiv = document.createElement("div");
          errorDiv.style.color = "#ef4444";
          errorDiv.style.marginTop = "1rem";
          errorDiv.style.fontFamily = "monospace";
          errorDiv.style.background = "rgba(239, 68, 68, 0.1)";
          errorDiv.style.padding = "0.75rem";
          errorDiv.style.border = "1px solid rgba(239, 68, 68, 0.2)";
          errorDiv.style.borderRadius = "6px";
          errorDiv.innerHTML = "<strong>Script Error:</strong> " + err.message;
          document.body.appendChild(errorDiv);
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
      />
    </div>
  );
}
