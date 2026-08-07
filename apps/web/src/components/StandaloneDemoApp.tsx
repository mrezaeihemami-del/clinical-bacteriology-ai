import React, { useState } from "react";
import { FlaskConical, Upload, Key, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export function StandaloneDemoApp() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GEMINI_DEMO_KEY") || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("EMB Agar");
  const [specimenType, setSpecimenType] = useState("URINE");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysisResult(null);
      setError("");
    }
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("GEMINI_DEMO_KEY", key);
  };

  const runDirectAiAnalysis = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setError("Please enter your Google Gemini API Key first.");
      return;
    }
    if (!selectedFile) {
      setError("Please upload an agar plate image to analyze.");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);
      const base64Data = await base64Promise;

      const promptText = `You are acting as an expert Senior Clinical Microbiologist.
Analyze this agar culture plate image. Specimen Type: ${specimenType}, Media: ${mediaType}.
Provide detailed microbiological analysis in valid JSON format with the following keys:
- imageQuality: "adequate", "borderline", or "inadequate"
- growthPattern: string describing overall growth
- gramStainHypothesis: "gram_negative_suspected", "gram_positive_suspected", or "mixed_flora_suspected" (Explain based on media like EMB/MacConkey and 3D morphology to bypass manual staining)
- threeDimensionalMorphology: { elevation: string, margin: string, pigmentation: string, opticalProperty: string }
- clinicalObservations: array of detailed clinical findings (e.g. lactose fermentation, metallic sheen, hemolysis)
- recommendedAction: string suggesting next diagnostic steps
- confidence: number between 0 and 1`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  {
                    inline_data: {
                      mime_type: selectedFile.type || "image/jpeg",
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: "application/json",
              temperature: 0.1,
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || `Gemini API Error: ${response.status}`);
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Received empty analysis text from Gemini.");

      const jsonText = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const parsed = JSON.parse(jsonText);
      setAnalysisResult(parsed);
    } catch (err: any) {
      setError(err?.message || "Failed to analyze image with Gemini AI.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #e5e7eb", paddingBottom: "15px", marginBottom: "25px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FlaskConical size={32} color="#0d9488" />
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", color: "#111827" }}>Clinical Bacteriology AI Assistant</h1>
            <span style={{ fontSize: "13px", color: "#6b7280" }}>Multimodal AI Agar Plate & Gram Bypass Demo Mode</span>
          </div>
        </div>
      </header>

      <section style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "8px", marginBottom: "25px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Key size={18} color="#166534" />
          <strong style={{ color: "#166534" }}>Google Gemini API Key</strong>
        </div>
        <input
          type="password"
          placeholder="Paste your Gemini API Key here (AIzaSy...)"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #9ca3af", boxSizing: "border-box" }}
        />
        <small style={{ color: "#4b5563", marginTop: "4px", display: "block" }}>
          Your key stays strictly in your browser local storage.
        </small>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "25px" }}>
        <div style={{ border: "2px dashed #cbd5e1", padding: "20px", borderRadius: "8px", textAlign: "center" }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Agar Plate Preview" style={{ maxWidth: "100%", maxHeight: "250px", borderRadius: "6px", objectFit: "contain" }} />
          ) : (
            <div style={{ padding: "40px 0", color: "#94a3b8" }}>
              <Upload size={48} style={{ margin: "0 auto 10px" }} />
              <p>Upload Agar Plate Image (JPEG/PNG)</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginTop: "10px" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>Culture Media Type:</label>
            <select value={mediaType} onChange={(e) => setMediaType(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px" }}>
              <option value="EMB Agar">EMB Agar (Eosin Methylene Blue)</option>
              <option value="Blood Agar">Blood Agar</option>
              <option value="MacConkey Agar">MacConkey Agar</option>
              <option value="Chromogenic Agar">Chromogenic Agar</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>Specimen Type:</label>
            <select value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px" }}>
              <option value="URINE">Urine</option>
              <option value="STERILE_SITE">Sterile Site / Blood</option>
              <option value="SPUTUM">Sputum / Respiratory</option>
              <option value="WOUND">Wound / Swab</option>
            </select>
          </div>

          <button
            onClick={runDirectAiAnalysis}
            disabled={analyzing}
            style={{
              backgroundColor: analyzing ? "#94a3b8" : "#0d9488",
              color: "white",
              padding: "12px",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "16px",
              cursor: analyzing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "auto",
            }}
          >
            <Sparkles size={20} />
            {analyzing ? "Analyzing with Gemini AI..." : "Run AI Bacteriology Analysis"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", padding: "12px", borderRadius: "6px", marginBottom: "20px" }}>
          <AlertCircle size={18} style={{ verticalAlign: "middle", marginRight: "8px" }} />
          {error}
        </div>
      )}

      {analysisResult && (
        <section style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "20px", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "15px" }}>
            <CheckCircle2 color="#16a34a" size={24} />
            <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>AI Microbiological Analysis Results</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
            <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>GRAM STAIN REACTION HYPOTHESIS:</span>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "#0284c7" }}>
                {analysisResult.gramStainHypothesis?.replace(/_/g, " ").toUpperCase() || "N/A"}
              </div>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>GROWTH PATTERN & CONFIDENCE:</span>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#334155" }}>
                {analysisResult.growthPattern?.replace(/_/g, " ")} ({Math.round((analysisResult.confidence || 0.9) * 100)}%)
              </div>
            </div>
          </div>

          {analysisResult.threeDimensionalMorphology && (
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#334155" }}>3D Colony Morphology:</h4>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569" }}>
                <li><strong>Elevation:</strong> {analysisResult.threeDimensionalMorphology.elevation}</li>
                <li><strong>Margin:</strong> {analysisResult.threeDimensionalMorphology.margin}</li>
                <li><strong>Pigmentation / Color:</strong> {analysisResult.threeDimensionalMorphology.pigmentation}</li>
                <li><strong>Optical Property:</strong> {analysisResult.threeDimensionalMorphology.opticalProperty}</li>
              </ul>
            </div>
          )}

          {analysisResult.clinicalObservations && (
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#334155" }}>Detailed Clinical Observations:</h4>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569" }}>
                {analysisResult.clinicalObservations.map((obs: string, idx: number) => (
                  <li key={idx}>{obs}</li>
                ))}
              </ul>
            </div>
          )}

          {analysisResult.recommendedAction && (
            <div style={{ backgroundColor: "#f0f9ff", borderLeft: "4px solid #0284c7", padding: "12px", borderRadius: "4px" }}>
              <strong style={{ color: "#0369a1" }}>Recommended Laboratory Action:</strong>
              <p style={{ margin: "4px 0 0 0", color: "#0c4a6e" }}>{analysisResult.recommendedAction}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
