/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Mic,
  Square,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Globe,
  RefreshCw,
  Clock,
  Heart,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  Send,
  Database,
  Code,
  Sparkles,
  Info,
  Sliders,
  X,
  Download,
  Check
} from "lucide-react";
import { Locale, MedicalRecord, TranscriptResponse, PresetCase, ConfidenceValue, ClinicalCoding } from "./types";
import { PRESET_CASES } from "./data/presets";
import { createEmptyRecord } from "./utils/emptyState";
import { formatTemperature, formatGlucose } from "./utils/conversion";
import { generateFhirBundle } from "./utils/fhir";

function CodingBadges({ codes }: { codes?: ClinicalCoding[] }) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5" id="clinical-badges-row">
      {codes.map((c, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono px-2 py-0.5 rounded bg-slate-90/80 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-help shrink-0 shadow-sm"
          title={`${c.standard} code for ${c.display} (System URL: ${c.system})`}
        >
          <span className="font-bold uppercase text-[7.5px] text-indigo-600 border-r border-slate-200 pr-1 mr-0.5">
            {c.standard}
          </span>
          <span className="font-semibold text-slate-900">{c.code}</span>
          {c.display && (
            <span className="text-slate-500 font-normal truncate max-w-[125px] ml-0.5">
              ({c.display})
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  // Theme configuration (defaults to light mode)
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Region configuration
  const [locale, setLocale] = useState<Locale>("US");

  // Main intake state
  const [record, setRecord] = useState<MedicalRecord>(createEmptyRecord());
  const [processingReasoning, setProcessingReasoning] = useState<string>(
    "EHR is waiting for voice input or simulated passage."
  );

  // Raw inputs for the pipeline
  const [transcriptInput, setTranscriptInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [useVoiceSimulator, setUseVoiceSimulator] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [bufferProgress, setBufferProgress] = useState<number>(0); // 0 to 100 for visual timer
  const [bufferedAudioSlicesCount, setBufferedAudioSlicesCount] = useState<number>(0);
  const [bufferedChunksLog, setBufferedChunksLog] = useState<string[]>([]);
  
  // SpeechRecognition refs (replaces MediaRecorder/base64 approach)
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");
  const recordingTimerRef = useRef<any>(null);
  const bufferTimerRef = useRef<any>(null);

  // Layout selection
  const [activeTab, setActiveTab] = useState<"presets" | "customText" | "voice">("customText");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [hasCompleted, setHasCompleted] = useState<boolean>(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("chest-pain-clear");
  const [promptView, setPromptView] = useState<"standard" | "structured" | "regional">("standard");

  // Prompt Builder custom options
  const [promptOptions, setPromptOptions] = useState({
    includeHinglish: true,
    strictConfidence: true,
    localeGuidelines: true,
    gcsBreakdown: true,
    omitEmptyFields: true,
  });

  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedRecord, setCopiedRecord] = useState<boolean>(false);
  const [showJsonDump, setShowJsonDump] = useState<boolean>(false);
  const [payloadActiveTab, setPayloadActiveTab] = useState<"ehr" | "fhir">("ehr");
  const [fhirFilter, setFhirFilter] = useState<string>("all");
  const [copiedFhir, setCopiedFhir] = useState<boolean>(false);

  // Load a preset initially
  useEffect(() => {
    const defaultPreset = PRESET_CASES.find((p) => p.key === "chest-pain-clear");
    if (defaultPreset) {
      setTranscriptInput(defaultPreset.transcript);
    }
  }, []);

  // Sync preset choice to input text
  const handlePresetSelect = (key: string) => {
    setSelectedPresetKey(key);
    const preset = PRESET_CASES.find((p) => p.key === key);
    if (preset) {
      setTranscriptInput(preset.transcript);
      setErrorMessage(null);
    }
  };

  // Convert current vital display values dynamically on locale switch
  const getLocalizedTemp = (tempVal: string) => {
    const formatted = formatTemperature(tempVal, locale);
    return formatted.value ? `${formatted.value} ${formatted.unit}` : "—";
  };

  const getLocalizedGlucose = (glucoseVal: string) => {
    const formatted = formatGlucose(glucoseVal, locale);
    return formatted.value ? `${formatted.value} ${formatted.unit}` : "—";
  };

  // Helper colors for confidence levels
  const getConfidenceClasses = (confidence: "high" | "medium" | "low" | "none") => {
    switch (confidence) {
      case "high":
        return {
          border: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200",
          badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
          label: "text-blue-700 dark:text-blue-300",
        };
      case "medium":
        return {
          border: "border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200",
          badge: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700",
          label: "text-purple-700 dark:text-purple-300",
        };
      case "low":
        return {
          border: "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200",
          badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700",
          label: "text-rose-700 dark:text-rose-300",
        };
      case "none":
      default:
        return {
          border: "border-gray-200 dark:border-gray-800 bg-gray-50/20 text-gray-500 dark:text-gray-400",
          badge: "bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
          label: "text-gray-400 dark:text-gray-500",
        };
    }
  };

  // Dispatch raw extraction command to express/Gemini backend
  const runEhrExtraction = async (textPayload: string, voiceBase64?: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: textPayload,
          audio: voiceBase64,
          mimeType: "audio/webm",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to contact extraction backend");
      }

      const data: TranscriptResponse = await response.json();
      if (data && data.record) {
        setRecord(data.record);
        setHasCompleted(true);
        if (data.processingReasoning) {
          setProcessingReasoning(data.processingReasoning);
        } else {
          setProcessingReasoning("EHR Record generated with confidence markers successfully.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Unknown error occurred during clinical parser transcription");
    } finally {
      setIsProcessing(false);
    }
  };

  // Dynamic system and user prompt templates creator (matching user persona prompt goals)
  const generatePromptTemplate = () => {
    let promptText = `# SYSTEM PROMPT: Universal Clinical Extraction Engine (EHR-Scribe)
You are an advanced Emergency Department intake registrar.
Analyze conversation transcriptions, multi-lingual audio recordings, and medical notations.
Output a perfectly formatted clinical intake report in strict JSON format.

## General Guidelines:
1. Support multi-regional conventions across:
   - **US Layout**: Temp: Fahrenheit, Glucose: mg/dL, ID: medical record number (MRN).
   - **India Layout**: Temp: Celsius (with Fahrenheit fallback), Glucose: mg/dL, ID: UHID, bilingual clinical vocabulary (Hinglish/Hinglish-slang translation like "bukhar", "dard", "sugar" handled seamlessly).
   - **Australia Layout**: Temp: Celsius, Glucose: mmol/L, ID: Medicare / National UR, Australia clinical protocols.

2. Strict Confidence Tagging:
   Assign to each extracted entity/field a Confidence level:
   - "high" (Blue UI theme status): Mentioned directly and explicitly (e.g. "blood pressure is 120/80").
   - "medium" (Purple UI theme status): Translated from slang/Hindi words, inferred, or generalized with moderate clinic probability.
   - "low" (Red UI theme status): Ambiguous statements, contradictory reports, or severe third-party doubt.
   - "none" (Gray/Empty status): Completely omitted in the speech. Keep value field empty or null.

3. Field Specific Mapping & Conversions:
`;

    if (promptOptions.includeHinglish) {
      promptText += `   - Handle mixed Hindi/English (Hinglish) expressions:
       • "Inka naam Rajesh Kumar hai" -> Full Name: Rajesh Kumar.
       • "Teen din se bukhar hai aur saas lene mein dikkat" -> Duration: 3 days, Chief Complaint: Fever & breathlessness (dyspnea).
       • "BP control mein hai, ekdum normal 120 over 80" -> BP Systolic: 120, BP Diastolic: 80, Confidence: medium (inferred as normal).
`;
    }

    if (promptOptions.strictConfidence) {
      promptText += `   - Do NOT assume empty vitals. If heartrate is unspecified, mark confidence "none" and keep value empty.
   - Set "allergiesNkda" = true only if explicit negative history is present ("No allergies" or "NKDA").
`;
    }

    if (promptOptions.gcsBreakdown) {
      promptText += `   - Carefully extract Glasgow Coma Scale (GCS) components:
       • Eye (1-4), Verbal (1-5), Motor (1-6), and Total score (sum 3-15).
       • E.g. "Eyes open to pain (Eye = 2), confused speech (Verbal = 4), withdraws from pain (Motor = 4). Total: 10/15".
`;
    }

    if (promptOptions.omitEmptyFields) {
      promptText += `   - Always preserve blanks so omitting information will not break the formatting. Keep the JSON keys intact but clear values.
`;
    }

    promptText += `
## Target JSON Output Schema constraint:
\`\`\`json
{
  "record": {
    "patientHeader": {
      "fullName": { "value": "...", "confidence": "high|medium|low|none", "originalText": "..." },
      "dob": { "value": "...", "confidence": "high|medium|low|none" },
...
    }
  }
}
\`\`\``;

    return promptText.trim();
  };

  // Audio Recording Mechanism with custom 15-20s Buffering transcription triggers
  const startRecordingAudio = async () => {
    setErrorMessage(null);
    if (useVoiceSimulator) {
      startSimulatedVoiceRecording(false);
      return;
    }

    // Use Web Speech API for live browser-side transcription
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported. Switching to Voice Simulator.");
      setUseVoiceSimulator(true);
      startSimulatedVoiceRecording(true);
      return;
    }

    liveTranscriptRef.current = "";
    setRecordingSeconds(0);
    setBufferProgress(0);
    setBufferedAudioSlicesCount(0);
    setBufferedChunksLog(["Recording session initiated.", "Listening via browser speech engine..."]);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + " ";
      }
      liveTranscriptRef.current = fullTranscript.trim();
      setTranscriptInput(liveTranscriptRef.current);
    };

    recognition.onerror = (event: any) => {
      console.warn("SpeechRecognition error:", event.error);
      setBufferedChunksLog((prev) => [...prev, `⚠️ Speech recognition error: ${event.error}`]);
    };

    recognition.onend = () => {
      // Auto-restart if still in recording state (browser cuts off after silence)
      if (recognitionRef.current) {
        try { recognition.start(); } catch (_) {}
      }
    };

    recognition.start();
    setIsRecording(true);

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    bufferTimerRef.current = setInterval(() => {
      setBufferProgress((prev) => {
        if (prev >= 100) {
          setBufferedAudioSlicesCount((cnt) => cnt + 1);
          setBufferedChunksLog((l) => [
            ...l,
            `⚡ ${~~(liveTranscriptRef.current.split(" ").length)} words captured so far. Extraction runs on stop.`,
          ]);
          return 0;
        }
        return prev + (100 / 18);
      });
    }, 1000);
  };

  const startSimulatedVoiceRecording = (showAutoNotice = false) => {
    setRecordingSeconds(0);
    setBufferProgress(0);
    setBufferedAudioSlicesCount(0);
    setBufferedChunksLog([
      "🎙️ Virtual Voice Simulator Mode: ACTIVE",
      "Opening simulated high-fidelity vocal stream...",
      showAutoNotice 
        ? "⚠️ Note: Your browser blocked or lacks microphone device permissions. Gracefully fell back to Virtual Scribe Simulator." 
        : "Using currently selected preset case script for voice simulation trial."
    ]);
    setIsRecording(true);

    // Timer for counting seconds
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    // Buffering timer
    bufferTimerRef.current = setInterval(() => {
      setBufferProgress((prev) => {
        if (prev >= 100) {
          setBufferedAudioSlicesCount((cnt) => cnt + 1);
          setBufferedChunksLog((l) => [
            ...l,
            `⚡ Buffered 18-seconds simulated audio chunk. Simulating intermediate diagnostic parsing...`,
          ]);
          return 0;
        }
        return prev + (100 / 18);
      });
    }, 1000);
  };

  const stopSimulatedVoiceRecording = () => {
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    clearInterval(bufferTimerRef.current);
    setBufferProgress(0);
    setBufferedChunksLog((prev) => [...prev, "🎤 Simulated recording finalized. Run high-precision clinical parsing..."]);
    // Since there is no physical audio base64, we extract based on the selected case text
    runEhrExtraction(transcriptInput);
  };

  const stopRecordingAudio = () => {
    if (useVoiceSimulator) {
      stopSimulatedVoiceRecording();
      return;
    }
    // Stop Web Speech API
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    clearInterval(bufferTimerRef.current);
    setBufferProgress(0);
    setBufferedChunksLog((prev) => [...prev, "🎤 Recording stopped. Running final EHR extraction..."]);
    // Run final extraction on whatever was transcribed
    const finalText = liveTranscriptRef.current || transcriptInput;
    if (finalText) {
      runEhrExtraction(finalText);
    }
  };

  // Trigger text transcription manually
  const triggerTextParse = () => {
    runEhrExtraction(transcriptInput);
  };

  const handleCopyRecord = () => {
    navigator.clipboard.writeText(JSON.stringify(record, null, 2));
    setCopiedRecord(true);
    setTimeout(() => setCopiedRecord(false), 2000);
  };

  const handleDownloadFhir = () => {
    try {
      const fhirBundle = generateFhirBundle(record);
      const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = record.patientHeader.fullName.value ? record.patientHeader.fullName.value.toLowerCase().replace(/\s+/g, "_") : "patient";
      a.download = `pimed_fhir_${name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate or download FHIR bundle", e);
    }
  };

  const handleCopyFhir = () => {
    try {
      const fhirBundle = generateFhirBundle(record);
      navigator.clipboard.writeText(JSON.stringify(fhirBundle, null, 2));
      setCopiedFhir(true);
      setTimeout(() => setCopiedFhir(false), 2000);
    } catch (e) {
      console.error("Failed to copy FHIR bundle", e);
    }
  };

  const getFilteredFhirEntries = () => {
    try {
      const fhirBundle = generateFhirBundle(record);
      if (!fhirBundle || !fhirBundle.entry) return [];
      if (fhirFilter === "all") return fhirBundle.entry;
      return fhirBundle.entry.filter((e: any) => e.resource && e.resource.resourceType.toLowerCase() === fhirFilter.toLowerCase());
    } catch (e) {
      console.error("Error filtering FHIR entries", e);
      return [];
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatePromptTemplate());
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  // Inline value editor for the Doctor
  const updateRecordField = (section: keyof MedicalRecord, fieldKey: string, newValue: any) => {
    setRecord((prev: any) => {
      const updatedSection = { ...prev[section] };
      updatedSection[fieldKey] = {
        ...updatedSection[fieldKey],
        value: newValue,
        confidence: "high", // Editing validates it to absolute confidence
      };
      return {
        ...prev,
        [section]: updatedSection,
      };
    });
  };

  const handleResetIntake = () => {
    setRecord(createEmptyRecord());
    setTranscriptInput("");
    setHasCompleted(false);
    setProcessingReasoning("EHR is waiting for voice input or simulated passage.");
    setErrorMessage(null);
    setRecordingSeconds(0);
    setBufferProgress(0);
    setBufferedAudioSlicesCount(0);
    setBufferedChunksLog([]);
  };

  return (
    <div className={`min-h-screen transition-all duration-200 flex flex-col font-sans ${
      theme === "light" ? "bg-slate-50 text-slate-900" : "bg-slate-900 text-slate-100"
    }`}>
      
      {/* Top Header */}
      <header className={`border-b transition-all duration-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-md ${
        theme === "light" ? "border-slate-200 bg-white" : "border-slate-800 bg-slate-950"
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-indigo-500/20 shadow-inner">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-xl font-bold tracking-tight transition-colors ${
                theme === "light" ? "text-slate-900" : "text-white"
              }`}>PiMed Scribe</h1>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase border transition-colors ${
                theme === "light" 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                  : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              }`}>
                Dual Server-Side proxy
              </span>
            </div>
            <p className={`text-xs mt-0.5 transition-colors ${
              theme === "light" ? "text-slate-500" : "text-slate-400"
            }`}>
              Dual Prompt-Generator & Real-Time Clinical Intake Transcription Suite
            </p>
          </div>
        </div>

        {/* Toggle Sidebar & Global Regionalization Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Background Mode Selector */}
          <div className={`p-1 flex items-center gap-1 rounded-xl border transition-all ${
            theme === "light"
              ? "bg-slate-100 border-slate-200"
              : "bg-slate-900 border-slate-800"
          }`}>
            <button
              id="theme-light-btn"
              onClick={() => setTheme("light")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                theme === "light"
                  ? "bg-amber-400 text-slate-950 font-black shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>☀️ Light Mode</span>
            </button>
            <button
              id="theme-dark-btn"
              onClick={() => setTheme("dark")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                theme === "dark"
                  ? "bg-slate-850 text-white font-black shadow-sm border border-slate-700/50"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/55"
              }`}
            >
              <span>🌙 Dark Mode</span>
            </button>
          </div>

          <button
            id="toggle-sidebar-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isSidebarOpen
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950/20"
                : theme === "light"
                  ? "bg-slate-100 border-slate-205 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            {isSidebarOpen ? "Hide Presets" : "⚙️ Presets & System Prompt"}
          </button>

          <div className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
            theme === "light"
              ? "bg-slate-100 border-slate-200 text-slate-800"
              : "bg-slate-900 border-slate-800 text-slate-100"
          }`}>
            <span className={`text-[11px] font-bold px-2 flex items-center gap-1.5 flex-wrap ${
              theme === "light" ? "text-slate-600" : "text-slate-400"
            }`}>
              <Globe className="w-3.5 h-3.5" />
              Target Locale:
            </span>
            <button
              id="locale-us-btn"
              onClick={() => setLocale("US")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                locale === "US"
                  ? "bg-blue-600 text-white shadow-md font-bold"
                  : theme === "light"
                    ? "text-slate-605 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              🇺🇸 US
            </button>
            <button
              id="locale-india-btn"
              onClick={() => setLocale("India")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                locale === "India"
                  ? "bg-purple-600 text-white shadow-md font-bold"
                  : theme === "light"
                    ? "text-slate-605 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              🇮🇳 India
            </button>
            <button
              id="locale-australia-btn"
              onClick={() => setLocale("Australia")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                locale === "Australia"
                  ? "bg-cyan-600 text-white shadow-md font-bold"
                  : theme === "light"
                    ? "text-slate-605 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              🇦🇺 Australia
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6 relative">
        <aside
          id="collapsible-sidebar"
          className={`shrink-0 transition-all duration-300 ease-in-out border rounded-2xl flex flex-col gap-5 ${
            isSidebarOpen 
              ? `w-full lg:w-[350px] opacity-100 p-5 h-auto ${
                  theme === "light" ? "bg-white border-slate-200 shadow-md" : "bg-slate-950 border-slate-800"
                }` 
              : "w-0 p-0 border-0 opacity-0 h-0 lg:h-auto overflow-hidden pointer-events-none"
          }`}
        >
          {isSidebarOpen && (
            <div className="flex flex-col gap-5 h-full">
              <div className={`flex items-center justify-between border-b pb-2.5 transition-colors ${
                theme === "light" ? "border-slate-100" : "border-slate-800"
              }`}>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                    theme === "light" ? "text-slate-800" : "text-white"
                  }`}>Clinical Presets</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className={`p-1 rounded-lg transition-all border border-transparent ${
                    theme === "light"
                      ? "hover:bg-slate-100 text-slate-400 hover:text-slate-700 hover:border-slate-200"
                      : "hover:bg-slate-900 text-slate-500 hover:text-slate-200 hover:border-slate-800"
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Presets List */}
              <div className="flex flex-col gap-2">
                <span className={`text-[10px] uppercase font-mono tracking-wider transition-colors ${
                  theme === "light" ? "text-slate-450 text-slate-500" : "text-slate-500"
                }`}>
                  Select a simulation scenario:
                </span>
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                  {PRESET_CASES.map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        handlePresetSelect(preset.key);
                        // Force customText view to display the loaded preset transcript directly
                        setActiveTab("customText");
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
                        selectedPresetKey === preset.key
                          ? theme === "light"
                            ? "bg-blue-50/70 border-blue-400 text-blue-900 shadow-sm"
                            : "bg-slate-900 border-blue-500/50 shadow-inner text-white"
                          : theme === "light"
                            ? "bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-805"
                            : "bg-slate-950 border-slate-900 hover:bg-slate-900/40 text-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11.5px] font-bold transition-colors ${
                          selectedPresetKey === preset.key && theme === "light"
                            ? "text-blue-900"
                            : theme === "light" ? "text-slate-800" : "text-slate-200"
                        }`}>{preset.name}</span>
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded ${
                          preset.type === "clear" ? "bg-emerald-500/10 text-emerald-505 text-emerald-600 dark:text-emerald-400" :
                          preset.type === "realistic" ? "bg-purple-500/10 text-purple-605 text-purple-600 dark:text-purple-400" :
                          "bg-rose-500/10 text-rose-605 text-rose-600 dark:text-rose-400"
                        }`}>
                          {preset.type}
                        </span>
                      </div>
                      <p className={`text-[10.5px] line-clamp-1 transition-colors ${
                        theme === "light" ? "text-slate-500" : "text-slate-400"
                      }`}>{preset.transcript}</p>
                    </button>
                  ))}
                </div>

                <div className={`p-3 rounded-xl border transition-all ${
                  theme === "light" ? "bg-slate-50 border-slate-200/80" : "bg-slate-900/60 border-slate-900"
                }`}>
                  <h4 className={`text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    theme === "light" ? "text-slate-700" : "text-slate-300"
                  }`}>
                    <Info className="w-3 h-3 text-indigo-505 text-indigo-600 dark:text-indigo-400" />
                    Clinical Context
                  </h4>
                  <p className={`text-[10.5px] mt-1 leading-relaxed transition-colors ${
                    theme === "light" ? "text-slate-600" : "text-slate-400"
                  }`}>
                    {PRESET_CASES.find(p => p.key === selectedPresetKey)?.explanation}
                  </p>
                </div>
              </div>

              {/* Prompt Generator Section */}
              <div className={`border-t pt-4 flex flex-col gap-3 transition-colors ${
                theme === "light" ? "border-slate-100" : "border-slate-800"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-550 text-indigo-500 dark:text-indigo-400" />
                    <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                      theme === "light" ? "text-slate-800" : "text-white"
                    }`}>System Prompt</span>
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className={`border px-2 py-0.5 rounded text-[9px] font-semibold transition-all flex items-center gap-1 ${
                      theme === "light"
                        ? "text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-200"
                        : "text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border-slate-800"
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedPrompt ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className={`grid grid-cols-2 gap-1.5 p-2.5 rounded-lg border transition-colors ${
                  theme === "light" ? "bg-slate-50 border-slate-200" : "bg-slate-900/40 border-slate-900"
                }`}>
                  <label className={`flex items-center gap-1.5 text-[9.5px] font-medium select-none cursor-pointer transition-colors ${
                    theme === "light" ? "text-slate-600" : "text-slate-350"
                  }`}>
                    <input
                      type="checkbox"
                      checked={promptOptions.includeHinglish}
                      onChange={(e) => setPromptOptions(prev => ({ ...prev, includeHinglish: e.target.checked }))}
                      className={`rounded focus:ring-0 w-3 h-3 transition-colors ${
                        theme === "light"
                          ? "bg-white border-slate-250 text-indigo-600"
                          : "bg-slate-950 border-slate-800 text-indigo-500"
                      }`}
                    />
                    Accept Hinglish
                  </label>
                  <label className={`flex items-center gap-1.5 text-[9.5px] font-medium select-none cursor-pointer transition-colors ${
                    theme === "light" ? "text-slate-600" : "text-slate-350"
                  }`}>
                    <input
                      type="checkbox"
                      checked={promptOptions.strictConfidence}
                      onChange={(e) => setPromptOptions(prev => ({ ...prev, strictConfidence: e.target.checked }))}
                      className={`rounded focus:ring-0 w-3 h-3 transition-colors ${
                        theme === "light"
                          ? "bg-white border-slate-255 border-slate-250 text-indigo-600"
                          : "bg-slate-950 border-slate-800 text-indigo-500"
                      }`}
                    />
                    Strict Conf.
                  </label>
                </div>

                <div className={`flex gap-1.5 border-b pb-1.5 transition-colors ${
                  theme === "light" ? "border-slate-100" : "border-slate-900"
                }`}>
                  <button
                    onClick={() => setPromptView("standard")}
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded transition-colors ${
                      promptView === "standard" 
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/85 dark:text-indigo-300 dark:border-indigo-900" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Prompt Rules
                  </button>
                  <button
                    onClick={() => setPromptView("structured")}
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded transition-colors ${
                      promptView === "structured" 
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/85 dark:text-indigo-300 dark:border-indigo-900" 
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Target Schema
                  </button>
                </div>

                <div className={`rounded-xl p-2.5 border max-h-40 overflow-y-auto font-mono text-[9px] leading-normal scrollbar-thin transition-colors ${
                  theme === "light" 
                    ? "bg-slate-50 border-slate-200 text-slate-600" 
                    : "bg-slate-950 border-slate-900 text-slate-450"
                }`}>
                  {promptView === "standard" ? (
                    <pre className="whitespace-pre-wrap">{generatePromptTemplate()}</pre>
                  ) : (
                    <pre className="whitespace-pre-wrap text-emerald-600 dark:text-emerald-400">{JSON.stringify(JSON.parse('{ "fullName": { "value": "...", "confidence": "high|medium|low|none" } }'), null, 2)}</pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Workspace Frame */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {!hasCompleted ? (
            /* INITIAL CLEAN SETUP STATE: JUST OPTIONS FOR CUSTOM PASSAGE */
            <div className="max-w-2xl mx-auto w-full my-auto flex flex-col gap-6 py-6" id="initial-input-flow">
              <div className="text-center flex flex-col gap-2">
                <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full uppercase tracking-wider font-semibold w-max mx-auto animate-pulse">
                  ⚡ Clinical Transcription Stream
                </span>
                <h2 className={`text-2xl lg:text-3xl font-extrabold tracking-tight uppercase transition-colors ${
                  theme === "light" ? "text-slate-900" : "text-white"
                }`}>
                  Emergency Clinical Intake Engine
                </h2>
                <p className={`text-sm max-w-lg mx-auto transition-colors ${
                  theme === "light" ? "text-slate-600" : "text-slate-400"
                }`}>
                  Type clinical observations directly, select scenario presets from the top menu, or dictate live voice recordings with auto-buffered interpretation.
                </p>
              </div>

              <div className={`border rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all ${
                theme === "light" ? "bg-white border-slate-200" : "bg-slate-950 border-slate-800"
              }`}>
                <div className={`flex border-b p-1 transition-all ${
                  theme === "light" ? "border-slate-100 bg-slate-50/80" : "border-slate-800 bg-slate-900/60"
                }`}>
                  <button
                    onClick={() => {
                      setActiveTab("customText");
                      setTranscriptInput("");
                    }}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeTab === "customText"
                        ? theme === "light"
                          ? "bg-white text-purple-600 border border-slate-200 shadow-sm font-black"
                          : "bg-slate-950 text-purple-400 border border-slate-800"
                        : theme === "light"
                          ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                          : "text-slate-400 hover:text-slate-205 hover:bg-slate-850"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    ⌨️ Type Custom Passage
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("voice");
                      setTranscriptInput("");
                    }}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      activeTab === "voice"
                        ? theme === "light"
                          ? "bg-white text-rose-605 text-rose-600 border border-slate-200 shadow-sm font-black"
                          : "bg-slate-950 text-rose-450 border border-slate-800"
                        : theme === "light"
                          ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
                          : "text-slate-400 hover:text-slate-205 hover:bg-slate-850"
                    }`}
                  >
                    <Mic className="w-4 h-4 text-rose-500 animate-pulse" />
                    🎤 Speak Live Passage
                  </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                  {/* TEXTAREA VIEW */}
                  {activeTab === "customText" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                          Input Doctor spoken notes or passage:
                        </span>
                        {transcriptInput && (
                          <button 
                            onClick={() => setTranscriptInput("")}
                            className="text-[10px] text-slate-500 hover:text-slate-350 font-semibold"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <textarea
                        id="custom-passage-textarea"
                        placeholder="Type spoken text observations or clinical logs. (e.g., 'Patient presentation: male with severe chest pain starting 2 hours ago. BP is 130 over 80...')"
                        value={transcriptInput}
                        onChange={(e) => setTranscriptInput(e.target.value)}
                        className="w-full min-h-[180px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 font-mono resize-y"
                      />
                      <span className="text-[10px] text-slate-500 text-left leading-normal">
                        Tip: Open the **Presets & System Prompt** menu from the top bar to automatically load a mock clinical conversation.
                      </span>
                    </div>
                  )}

                  {/* LIVE BUFFER RECORDER VIEW */}
                  {activeTab === "voice" && (
                    <div className="flex flex-col gap-4">
                      {/* Audio Input Selector Controls */}
                      <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        theme === "light" 
                          ? "bg-slate-100/80 border-slate-200" 
                          : "bg-slate-900/60 border-slate-800"
                      }`}>
                        <div className="flex flex-col text-left">
                          <span className={`text-[11px] font-bold ${theme === "light" ? "text-slate-800" : "text-slate-200"}`}>
                            Vocal Input Stream Source
                          </span>
                          <span className="text-[9.5px] text-slate-500">
                            {useVoiceSimulator ? "Virtual simulator loaded" : "Real physical microphone"}
                          </span>
                        </div>
                        <div className="flex p-0.5 bg-slate-950 border border-slate-850 rounded-lg">
                          <button
                            type="button"
                            disabled={isRecording}
                            onClick={() => {
                              setUseVoiceSimulator(false);
                              setErrorMessage(null);
                            }}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded transition cursor-pointer disabled:opacity-50 ${
                              !useVoiceSimulator 
                                ? "bg-rose-600 text-white shadow-sm" 
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Physical Mic
                          </button>
                          <button
                            type="button"
                            disabled={isRecording}
                            onClick={() => {
                              setUseVoiceSimulator(true);
                              setErrorMessage(null);
                            }}
                            className={`px-3 py-1 text-[10px] font-bold font-mono rounded transition cursor-pointer disabled:opacity-50 relative ${
                              useVoiceSimulator 
                                ? "bg-indigo-600 text-white shadow-sm" 
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            Virtual Sim
                            {useVoiceSimulator && (
                              <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {useVoiceSimulator && (
                        <div className="bg-indigo-600/10 border border-indigo-500/15 text-indigo-400 text-[11px] p-3.5 rounded-xl text-left flex items-start gap-2.5">
                          <span className="text-sm">💡</span>
                          <div>
                            <span className="font-bold block text-indigo-350">How the Virtual Scribe Simulator works:</span>
                            When you start recording, we'll stream a real-time speech telemetry model based on your currently selected Case (under the <span className="font-bold underline">Presets</span> tab). Perfect for testing in sandboxes or locked browser environments!
                          </div>
                        </div>
                      )}

                      <div className={`rounded-xl p-6 border text-center flex flex-col items-center justify-center gap-4 transition-all ${
                        theme === "light" 
                          ? "bg-slate-50 border-slate-200/80 shadow-inner" 
                          : "bg-slate-900/40 border-slate-800"
                      }`}>
                        {!isRecording ? (
                          <div className="flex flex-col items-center gap-3 w-full animate-fadeIn">
                            {/* Inactive Visual Indicator */}
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center relative transition-colors ${
                              theme === "light" ? "bg-slate-100" : "bg-slate-950"
                            }`}>
                              <Mic className={`w-8 h-8 transition-colors ${theme === "light" ? "text-slate-400" : "text-slate-600"}`} />
                              <span className="absolute -inset-1.5 rounded-full border border-dashed border-red-500/20" />
                            </div>

                            <button
                              id="start-recording-btn"
                              type="button"
                              onClick={startRecordingAudio}
                              className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 cursor-pointer w-full max-w-xs"
                            >
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              Start Clinical Recording
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 w-full">
                            {/* Active Visual Indicator */}
                            <div className="w-20 h-20 rounded-full bg-rose-500/10 border-2 border-rose-500 flex items-center justify-center relative animate-pulse">
                              <Mic className="w-8 h-8 text-rose-500 animate-pulse" />
                              <span className="absolute -inset-2 rounded-full border border-rose-500/40 animate-ping duration-1000" />
                            </div>

                            <button
                              id="stop-recording-btn"
                              type="button"
                              onClick={stopRecordingAudio}
                              className={`px-6 py-3 rounded-xl border font-bold text-xs tracking-wider uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer w-full max-w-xs ${
                                theme === "light"
                                  ? "bg-slate-900 border-slate-900 hover:bg-slate-950 text-white shadow-slate-200"
                                  : "bg-slate-200 border-white hover:bg-white text-slate-950 shadow-slate-950/40"
                              }`}
                            >
                              <Square className="w-3 h-3 fill-rose-500 text-rose-500" />
                              Stop & Save Recording
                            </button>
                          </div>
                        )}

                        <div>
                          <h4 className={`text-sm font-bold transition-all ${
                            theme === "light" ? "text-slate-800" : "text-slate-200"
                          }`}>
                            {isRecording ? "Transcribing Voice Stream" : "Ready to Capture Speech"}
                          </h4>
                          <p className={`text-xs mt-1 transition-all ${
                            theme === "light" ? "text-slate-600" : "text-slate-400"
                          }`}>
                            {isRecording 
                              ? `Recording Time: ${recordingSeconds}s` 
                              : "Tap 'Start Clinical Recording' to begin voice stream. Audio chunk buffers are sent to the parser every 18 seconds."
                            }
                          </p>
                        </div>

                        {/* Progress bar */}
                        {isRecording && (
                          <div className="w-full max-w-sm mt-2">
                            <div className={`flex justify-between text-[10px] mb-1 font-mono transition-colors ${
                              theme === "light" ? "text-slate-500" : "text-slate-400"
                            }`}>
                              <span>18s Audio Slice Buffer</span>
                              <span>{Math.round(bufferProgress)}% filled</span>
                            </div>
                            <div className={`w-full h-2 rounded-full overflow-hidden transition-colors ${
                              theme === "light" ? "bg-slate-200" : "bg-slate-850"
                            }`}>
                              <div 
                                className="bg-indigo-500 h-full transition-all duration-1000 ease-linear"
                                style={{ width: `${bufferProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Buffer logs queue */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 text-left">
                          Buffer Queue transactions ({bufferedAudioSlicesCount} Chunks):
                        </span>
                        <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[9px] text-slate-400 flex flex-col gap-1.5 scrollbar-thin text-left">
                          {bufferedChunksLog.length === 0 ? (
                            <span className="text-slate-600 italic">No audio transactions buffered yet...</span>
                          ) : (
                            bufferedChunksLog.map((log, index) => (
                              <div key={index} className="flex gap-1.5 items-start">
                                <span className="text-indigo-400">►</span>
                                <span className="leading-snug">{log}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    id="submit-extraction-btn"
                    onClick={triggerTextParse}
                    disabled={isProcessing || (activeTab === "customText" && !transcriptInput.trim())}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 disabled:active:scale-100 py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-900/35 flex items-center justify-center gap-2 text-white mt-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        Generating EHR Sheet...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-white" />
                        Extract Clinical EHR Form
                      </>
                    )}
                  </button>

                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-start gap-2.5 text-left">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-rose-300">Extraction Diagnostic Feedback</span>
                        <p className="text-[11px] text-rose-400 mt-0.5 leading-relaxed">{errorMessage}</p>
                        
                        {(errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("notallowed") || errorMessage.toLowerCase().includes("blocked") || errorMessage.toLowerCase().includes("denied")) && (
                          <div className="mt-2.5 pt-2 border-t border-rose-500/10 flex flex-col gap-1.5">
                            <span className="text-[10px] text-slate-400">
                              Tip: Your browser or workspace frame is preventing microphone input access. Bypass this with our offline Virtual Scribe Simulator to see exact telemetry and R4 logs.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setUseVoiceSimulator(true);
                                setErrorMessage(null);
                                setActiveTab("voice");
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition self-start cursor-pointer"
                            >
                              Activate Virtual Voice Simulator Mode
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* COMPLETED STATE: SIDE BY SIDE PANELS */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
              
              {/* Left Side: Compact Input Workspace */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                
                {/* Reset controller */}
                <div className={`transition-all border rounded-2xl p-4 shadow-xl flex items-center justify-between ${
                  theme === "light" ? "bg-white border-slate-200" : "bg-slate-950 border-slate-800"
                }`}>
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wide transition-colors ${
                      theme === "light" ? "text-slate-800" : "text-slate-200"
                    }`}>Active Intake Case</h4>
                    <span className={`text-[10px] font-mono transition-colors ${
                      theme === "light" ? "text-slate-500" : "text-slate-400"
                    }`}>EHR Form Rendered</span>
                  </div>
                  <button
                    id="reset-intake-btn"
                    onClick={handleResetIntake}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    New Intake
                  </button>
                </div>

                {/* Original passage visualization */}
                <div className={`transition-all border rounded-2xl p-5 shadow-xl flex flex-col gap-4 ${
                  theme === "light" ? "bg-white border-slate-200" : "bg-slate-950 border-slate-800"
                }`}>
                  <div className={`flex border-b pb-2.5 justify-between items-center transition-colors ${
                    theme === "light" ? "border-slate-100" : "border-slate-900"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                      theme === "light" ? "text-slate-700" : "text-slate-200"
                    }`}>
                      <FileText className="w-4 h-4 text-purple-650 text-purple-600 dark:text-purple-400" />
                      Original Passage
                    </span>
                    <button
                      onClick={() => {
                        setActiveTab(activeTab === "customText" ? "voice" : "customText");
                      }}
                      className="text-[9.5px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline uppercase transition-all"
                    >
                      {activeTab === "customText" ? "Show Mic State" : "Show Text Input"}
                    </button>
                  </div>

                  {activeTab === "customText" ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={transcriptInput}
                        onChange={(e) => setTranscriptInput(e.target.value)}
                        className={`w-full h-44 border rounded-xl p-3 text-xs outline-none font-mono resize-y transition-colors ${
                          theme === "light"
                            ? "bg-slate-50 border-slate-200 text-slate-800 focus:bg-white"
                            : "bg-slate-900 border-slate-800 text-slate-300 focus:bg-slate-900"
                        }`}
                        placeholder="Raw text logs..."
                      />
                    </div>
                  ) : (
                    <div className={`p-4 rounded-xl border text-center flex flex-col items-center justify-center gap-2 transition-colors ${
                      theme === "light" ? "bg-slate-50 border-slate-250 border-slate-200" : "bg-slate-900/60 border-slate-800"
                    }`}>
                      <Mic className="w-7 h-7 text-rose-505 text-rose-500 animate-pulse mb-1" />
                      <span className={`text-xs font-bold transition-colors ${
                        theme === "light" ? "text-slate-800" : "text-slate-200"
                      }`}>Voice Record Loaded</span>
                      <p className={`text-[10.5px] leading-relaxed transition-colors ${
                        theme === "light" ? "text-slate-500" : "text-slate-400"
                      }`}>
                        Recorded {recordingSeconds} seconds of live dictation stream.
                      </p>
                    </div>
                  )}

                  <button
                    id="reprocess-extraction-btn"
                    onClick={triggerTextParse}
                    disabled={isProcessing || (activeTab === "customText" && !transcriptInput.trim())}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:scale-98 text-white py-3 rounded-xl font-bold text-xs uppercase transition shadow flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-white" />
                    )}
                    Reprocess & Interpret
                  </button>
                </div>

                {/* Practical Tip card */}
                <div className="bg-indigo-950/20 border border-indigo-500/20 p-4 rounded-2xl flex items-start gap-3 text-left">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-indigo-300">Intelligent Workstation</span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      To fix spelling mistakes or manually fill empty boxes, click and type directly into any card in the clinical paper sheet on the right.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side Panel: Clinical Intake Sheet */}
              <section className="lg:col-span-8 flex flex-col gap-6" id="intake-display-sheet">
          
          {/* EHR Intake Sheet container */}
          <div className="bg-white text-slate-900 rounded-3xl p-6 lg:p-8 shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
            
            {/* Paper design background details */}
            <div className="absolute right-0 top-0 bg-slate-100 text-[10px] font-mono text-slate-400 px-3 py-1 uppercase tracking-widest border-bl border-slate-200">
              Emergency Dept. Sheet / Universal format
            </div>

            {/* Diagnostic Header */}
            <div className="border-b-4 border-slate-900 pb-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Emergency Dept. Clinical Intake Assessment</h2>
                  <p className="text-xs text-slate-500 font-mono mt-1 font-semibold uppercase tracking-wider">
                    Confidence Legend: <span className="text-blue-600 font-bold">● High (Blue)</span> | <span className="text-purple-600 font-bold">● Medium (Purple)</span> | <span className="text-rose-600 font-bold">● Low (Red)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Content Sheets organized in exact requested modules */}
            <div className="space-y-6 text-xs text-slate-800">
              
              {/* [ 1. PATIENT IDENTIFICATION & HEADER ] */}
              <div className="space-y-3" id="sec-patient-header">
                <div className="border-b-2 border-slate-800 pb-1 flex items-center justify-between">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">[ 1. PATIENT IDENTIFICATION & HEADER ]</h3>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">US • India • Aus</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Full Name */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.fullName.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      value={record.patientHeader.fullName.value}
                      placeholder="e.g. John Doe / Rajesh Kumar"
                      onChange={(e) => updateRecordField("patientHeader", "fullName", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                    {record.patientHeader.fullName.originalText && (
                      <span className="text-[9px] text-slate-400 block mt-1 italic leading-tight">Heard: "{record.patientHeader.fullName.originalText}"</span>
                    )}
                  </div>

                  {/* DOB */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.dob.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DOB (Date of Birth)</label>
                    <input
                      type="text"
                      value={record.patientHeader.dob.value}
                      placeholder="e.g. DD/MM/YYYY"
                      onChange={(e) => updateRecordField("patientHeader", "dob", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Age */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.age.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Age</label>
                    <input
                      type="text"
                      value={record.patientHeader.age.value}
                      placeholder="e.g. 45"
                      onChange={(e) => updateRecordField("patientHeader", "age", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Gender */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.gender.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
                    <input
                      type="text"
                      value={record.patientHeader.gender.value}
                      placeholder="M / F / Other"
                      onChange={(e) => updateRecordField("patientHeader", "gender", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* MRN or Regional ID equivalents */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.mrn.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {locale === "US" ? "MRN" : locale === "India" ? "UHID / Hospital ID" : "UR / Medicare Number"}
                    </label>
                    <input
                      type="text"
                      value={record.patientHeader.mrn.value}
                      placeholder="e.g. 5566-7788"
                      onChange={(e) => updateRecordField("patientHeader", "mrn", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Time / Date of Arrival */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.timeOfArrival.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Arrival Time & Date</label>
                    <input
                      type="text"
                      value={record.patientHeader.timeOfArrival.value ? `${record.patientHeader.timeOfArrival.value} ${record.patientHeader.dateOfArrival.value || ""}` : ""}
                      placeholder="e.g. 10:15 / Today"
                      onChange={(e) => updateRecordField("patientHeader", "timeOfArrival", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Triage Category (1 to 5) */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.triageCategory.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Triage Category (1-5)</label>
                    <div className="flex gap-1.5 mt-1">
                      {["1", "2", "3", "4", "5"].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => updateRecordField("patientHeader", "triageCategory", num)}
                          className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${
                            record.patientHeader.triageCategory.value === num
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode of Arrival */}
                  <div className={`p-2.5 md:col-span-2 rounded-lg border-l-4 ${getConfidenceClasses(record.patientHeader.modeOfArrival.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mode of Arrival</label>
                    <input
                      type="text"
                      value={record.patientHeader.modeOfArrival.value}
                      placeholder="Walk-in / Ambulance"
                      onChange={(e) => updateRecordField("patientHeader", "modeOfArrival", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* [ 2. PERSONAL DETAILS & CONTACT ] */}
              <div className="space-y-3" id="sec-personal-details">
                <div className="border-b-2 border-slate-800 pb-1">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">[ 2. PERSONAL DETAILS & CONTACT ]</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Residential Address */}
                  <div className={`p-2.5 md:col-span-2 rounded-lg border-l-4 ${getConfidenceClasses(record.personalDetails.residentialAddress.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Residential Address</label>
                    <input
                      type="text"
                      value={record.personalDetails.residentialAddress.value}
                      placeholder="Specify street address / suburban details"
                      onChange={(e) => updateRecordField("personalDetails", "residentialAddress", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-250 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Prime / Alt Phone */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.personalDetails.primaryPhone.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Primary phone / Alternative</label>
                    <input
                      type="text"
                      value={record.personalDetails.primaryPhone.value}
                      placeholder="e.g. +1... / +91..."
                      onChange={(e) => updateRecordField("personalDetails", "primaryPhone", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-250 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Emergency Contact Name / Relationship */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.personalDetails.emergencyContactName.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Emergency Contact & Relationship</label>
                    <input
                      type="text"
                      value={record.personalDetails.emergencyContactName.value ? `${record.personalDetails.emergencyContactName.value} (${record.personalDetails.relationship.value || "Spouse"})` : ""}
                      placeholder="e.g. Mary Miller (Wife)"
                      onChange={(e) => updateRecordField("personalDetails", "emergencyContactName", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-250 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* [ 3. INITIAL PRESENTATION & SYMPTOMS ] */}
              <div className="space-y-4" id="sec-presentation-symptoms">
                <div className="border-b-2 border-slate-800 pb-1">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">
                    [ 3. INITIAL PRESENTATION & SYMPTOMS ]
                  </h3>
                </div>

                {/* Chief Complaint */}
                <div className={`p-3.5 rounded-xl border-l-4 ${getConfidenceClasses(record.presentation.chiefComplaint.confidence).border}`}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Chief Complaint / Reason for Presentation</label>
                  <textarea
                    rows={2}
                    value={record.presentation.chiefComplaint.value}
                    placeholder="Describe the clinical presentation story..."
                    onChange={(e) => updateRecordField("presentation", "chiefComplaint", e.target.value)}
                    className="w-full bg-transparent text-slate-900 font-semibold border-b border-slate-200 outline-none focus:border-slate-400 resize-none py-1 leading-relaxed"
                  />
                  {record.presentation.chiefComplaint.originalText && (
                    <span className="text-[9px] text-slate-400 block mt-1 italic">Vocalized: "{record.presentation.chiefComplaint.originalText}"</span>
                  )}
                  <CodingBadges codes={record.presentation.chiefComplaint.codes} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Onset */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.historyOnset.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">History of Symptoms: Onset</label>
                    <input
                      type="text"
                      value={record.presentation.historyOnset.value}
                      placeholder="e.g. 2 hours ago / Subah se"
                      onChange={(e) => updateRecordField("presentation", "historyOnset", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Duration */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.historyDuration.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration</label>
                    <input
                      type="text"
                      value={record.presentation.historyDuration.value}
                      placeholder="e.g. 3 days"
                      onChange={(e) => updateRecordField("presentation", "historyDuration", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Severity (with custom highlights for score triggers) */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.historySeverity.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex justify-between">
                      <span>Severity</span>
                      {record.presentation.historySeverity.value && (
                        <span className="text-[9.5px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 rounded font-mono font-bold">
                          Rating: {record.presentation.historySeverity.value}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={record.presentation.historySeverity.value}
                      placeholder="e.g. 8 out of 10 / severe"
                      onChange={(e) => updateRecordField("presentation", "historySeverity", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Aggravating factors */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.historyAggravating.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Aggravating Factors</label>
                    <input
                      type="text"
                      value={record.presentation.historyAggravating.value}
                      placeholder="e.g. worsening while walking"
                      onChange={(e) => updateRecordField("presentation", "historyAggravating", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>
                </div>

                {/* ALLERGIES */}
                <div className={`p-3.5 rounded-xl border-l-4 ${
                  record.presentation.allergiesNkda.value 
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 text-[11px]" 
                    : getConfidenceClasses(record.presentation.allergiesList.confidence).border
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">ALLERGIES</label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!record.presentation.allergiesNkda.value}
                        onChange={(e) => {
                          setRecord((prev: any) => ({
                            ...prev,
                            presentation: {
                              ...prev.presentation,
                              allergiesNkda: { value: e.target.checked, confidence: "high" },
                              allergiesList: { value: e.target.checked ? "NKDA (No Known Drug Allergies)" : "", confidence: "high" }
                            }
                          }));
                        }}
                        className="rounded border-slate-350 text-emerald-600 focus:ring-0"
                      />
                      NKDA (No Known Drug Allergies)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={record.presentation.allergiesList.value}
                    placeholder="Specify patient allergies (e.g., Penicillin, Sulfa, peanuts)"
                    onChange={(e) => updateRecordField("presentation", "allergiesList", e.target.value)}
                    className="w-full bg-transparent font-semibold border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                  />
                </div>

                {/* Past medical history & current meds */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.pastHistory.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Past Medical History</label>
                    <input
                      type="text"
                      value={record.presentation.pastHistory.value}
                      placeholder="e.g. Hypertension, Diabetes, Asthma"
                      onChange={(e) => updateRecordField("presentation", "pastHistory", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                    <CodingBadges codes={record.presentation.pastHistory.codes} />
                  </div>

                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.presentation.currentMedications.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Medications</label>
                    <input
                      type="text"
                      value={record.presentation.currentMedications.value}
                      placeholder="e.g. Aspirin, Lipitor, Lisinopril"
                      onChange={(e) => updateRecordField("presentation", "currentMedications", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>
                </div>
              </div>


              {/* [ 4. CLINICAL OBSERVATIONS & READINGS (VITALS) ] */}
              <div className="space-y-4 text-slate-800" id="sec-readings-vitals">
                <div className="border-b-2 border-slate-800 pb-1 flex justify-between items-center">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">
                    [ 4. CLINICAL OBSERVATIONS & READINGS (VITALS) ]
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Metrics auto-convert according to regional locales
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  
                  {/* BP */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${
                    getConfidenceClasses(record.vitals.bpSystolic.confidence).border
                  }`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">BP (Blood Pressure)</label>
                    <div className="flex items-center gap-1 font-semibold text-slate-900">
                      <input
                        type="text"
                        value={record.vitals.bpSystolic.value}
                        placeholder="Sys"
                        onChange={(e) => updateRecordField("vitals", "bpSystolic", e.target.value)}
                        className="w-8 text-center bg-transparent border-b border-slate-250 outline-none"
                      />
                      <span>/</span>
                      <input
                        type="text"
                        value={record.vitals.bpDiastolic.value}
                        placeholder="Dia"
                        onChange={(e) => updateRecordField("vitals", "bpDiastolic", e.target.value)}
                        className="w-8 text-center bg-transparent border-b border-slate-250 outline-none"
                      />
                      <span className="text-[9px] text-slate-400 font-mono font-normal">mmHg</span>
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.heartRate.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">HR (Heart Rate)</label>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <input
                        type="text"
                        value={record.vitals.heartRate.value}
                        placeholder="72"
                        onChange={(e) => updateRecordField("vitals", "heartRate", e.target.value)}
                        className="w-12 bg-transparent font-semibold text-slate-900 border-b border-slate-250 outline-none"
                      />
                      <span className="text-[9px] text-slate-400 font-normal">bpm</span>
                    </div>
                  </div>

                  {/* Respiratory Rate */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.respiratoryRate.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RR (Resp Rate)</label>
                    <input
                      type="text"
                      value={record.vitals.respiratoryRate.value}
                      placeholder="18"
                      onChange={(e) => updateRecordField("vitals", "respiratoryRate", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-250 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Temperature */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.temperature.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex gap-1 items-center">
                      <Thermometer className="w-3 h-3 text-orange-500" />
                      Temperature
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-900">
                        {getLocalizedTemp(record.vitals.temperature.value)}
                      </span>
                      <span className="text-[9px] text-slate-400"> (route: {record.vitals.temperatureRoute.value || "Tympanic"})</span>
                    </div>
                  </div>

                  {/* SPO2 */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.spo2.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">SpO2 (Oxygen)</label>
                    <input
                      type="text"
                      value={record.vitals.spo2.value ? `${record.vitals.spo2.value}%` : ""}
                      placeholder="98%"
                      onChange={(e) => updateRecordField("vitals", "spo2", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-250 outline-none focus:border-slate-500 py-0.5"
                    />
                  </div>

                  {/* Blood Glucose Level */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.bloodGlucose.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Blood Glucose (BGL)</label>
                    <span className="font-semibold text-slate-900">
                      {getLocalizedGlucose(record.vitals.bloodGlucose.value)}
                    </span>
                  </div>

                  {/* Glasgow Coma Scale (GCS) */}
                  <div className={`p-2.5 md:col-span-2 rounded-lg border-l-4 ${getConfidenceClasses(record.vitals.gcsTotal.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      GCS Total (Glasgow Coma Scale)
                    </label>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span>E: {record.vitals.gcsEye.value || "—"}</span>
                      <span>V: {record.vitals.gcsVerbal.value || "—"}</span>
                      <span>M: {record.vitals.gcsMotor.value || "—"}</span>
                      <span className="font-bold bg-slate-900 text-white dark:bg-slate-850 px-2 py-0.5 rounded">
                        Total: {record.vitals.gcsTotal.value ? `${record.vitals.gcsTotal.value}/15` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vitals physical inspection checkboxes & notes */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="block text-[10.5px] font-bold text-slate-500 uppercase mb-2">Focused physical examination areas:</span>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
                    {Object.keys(record.vitals.examFindingsChecked).map((key) => {
                      const displayNames: any = {
                        neuro: "Neuro",
                        cardio: "Cardio",
                        resp: "Resp",
                        abdo: "Abdo",
                        musculoskeletal: "Musculo",
                        skin: "Skin"
                      };
                      const checked = (record.vitals.examFindingsChecked as any)[key];
                      return (
                        <label key={key} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setRecord((prev) => ({
                                ...prev,
                                vitals: {
                                  ...prev.vitals,
                                  examFindingsChecked: {
                                    ...prev.vitals.examFindingsChecked,
                                    [key]: e.target.checked
                                  }
                                }
                              }));
                            }}
                            className="rounded border-slate-350 text-slate-800 focus:ring-0"
                          />
                          {displayNames[key] || key}
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-500 uppercase mb-1">Clinician physical exam notes</label>
                    <input
                      type="text"
                      value={record.vitals.examFindingNotes.value}
                      placeholder="Click to specify objective examination notes..."
                      onChange={(e) => updateRecordField("vitals", "examFindingNotes", e.target.value)}
                      className="w-full bg-transparent text-slate-900 italic border-b border-slate-200 outline-none py-0.5"
                    />
                  </div>
                </div>
              </div>


              {/* [ 5. INITIAL INVESTIGATIONS & EMERGENCY TESTS ] */}
              <div className="space-y-4" id="sec-investigations">
                <div className="border-b-2 border-slate-800 pb-1">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">
                    [ 5. INITIAL INVESTIGATIONS & EMERGENCY TESTS ]
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Bedside tests (ECG) */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.investigations.ecgResult.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bedside ECG Result</label>
                    <input
                      type="text"
                      value={record.investigations.ecgResult.value}
                      placeholder="e.g. Normal sinus rhythm"
                      onChange={(e) => updateRecordField("investigations", "ecgResult", e.target.value)}
                      className="w-full bg-transparent font-semibold text-slate-900 border-b border-slate-200 outline-none"
                    />
                  </div>

                  {/* Urinalysis */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.investigations.urinalysisResult.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Urinalysis</label>
                    <input
                      type="text"
                      value={record.investigations.urinalysisResult.value}
                      placeholder="e.g. Negative for blood"
                      onChange={(e) => updateRecordField("investigations", "urinalysisResult", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none"
                    />
                  </div>

                  {/* ABG / VBG */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.investigations.vbgAbgResult.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ABG / VBG Blood Gases</label>
                    <input
                      type="text"
                      value={record.investigations.vbgAbgResult.value}
                      placeholder="e.g. pH 7.38 normal"
                      onChange={(e) => updateRecordField("investigations", "vbgAbgResult", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none"
                    />
                  </div>
                </div>

                {/* Laboratory pathology lists */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">LAB PATHOLOGY ORDERED:</span>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={record.investigations.labFbcOrdered.value}
                          onChange={(e) => updateRecordField("investigations", "labFbcOrdered", e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        FBC / CBC
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={record.investigations.labUeOrdered.value}
                          onChange={(e) => updateRecordField("investigations", "labUeOrdered", e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        U&E / BMP
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={record.investigations.labTroponinOrdered.value}
                          onChange={(e) => updateRecordField("investigations", "labTroponinOrdered", e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        Troponin T
                      </label>
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">IMAGING DIAGNOSTICS:</span>
                    <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                      <div className="flex items-center justify-between">
                        <span>X-Ray:</span>
                        <span className="font-bold text-slate-800">
                          {record.investigations.imgXrayOrdered.value ? `Ordered (${record.investigations.imgXrayRegion.value || "Chest"})` : "No"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>CT Scan:</span>
                        <span className="font-bold text-slate-800">
                          {record.investigations.imgCtOrdered.value ? `Ordered (${record.investigations.imgCtRegion.value || "Head"})` : "No"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* [ 6. EMERGENCY COURSE OF ACTION & NEXT STEPS ] */}
              <div className="space-y-4" id="sec-course-action">
                <div className="border-b-2 border-slate-800 pb-1">
                  <h3 className="font-bold tracking-wider text-sm uppercase text-slate-900">
                    [ 6. EMERGENCY COURSE OF ACTION & NEXT STEPS ]
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Working Diagnosis */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.courseOfAction.workingDiagnosis.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Working Diagnosis / Clinical Assessment</label>
                    <input
                      type="text"
                      value={record.courseOfAction.workingDiagnosis.value}
                      placeholder="e.g. Suspicious Pneumonia / ACS"
                      onChange={(e) => updateRecordField("courseOfAction", "workingDiagnosis", e.target.value)}
                      className="w-full bg-transparent font-bold text-slate-900 border-b border-slate-200 outline-none"
                    />
                    <CodingBadges codes={record.courseOfAction.workingDiagnosis.codes} />
                  </div>

                  {/* Immediate interventions given */}
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.courseOfAction.immediateInterventions.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Immediate ED Interventions Given</label>
                    <input
                      type="text"
                      value={record.courseOfAction.immediateInterventions.value}
                      placeholder="e.g. IV Fluids, supplemental oxygen"
                      onChange={(e) => updateRecordField("courseOfAction", "immediateInterventions", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none"
                    />
                    <CodingBadges codes={record.courseOfAction.immediateInterventions.codes} />
                  </div>
                </div>

                {/* ED Medication Records (Administered) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">ED MEDICATION ADMINISTRATION RECORD:</span>
                  
                  {record.courseOfAction.medications && record.courseOfAction.medications.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No ED medications recorded as administered.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {record.courseOfAction.medications?.map((med, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-lg text-[11px] hover:shadow-sm transition flex flex-col gap-1.5">
                          <div className="grid grid-cols-5 gap-1.5">
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Drug</span>
                              <span className="font-bold text-slate-900">{med.drug}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Dose</span>
                              <span className="font-semibold text-slate-700">{med.dose}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Route</span>
                              <span className="text-slate-700">{med.route}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Time</span>
                              <span className="text-slate-500">{med.time}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] text-slate-400 uppercase font-bold">Sign</span>
                              <span className="text-slate-900 font-bold font-mono text-[9px]">{med.sign || "—"}</span>
                            </div>
                          </div>
                          {med.codes && med.codes.length > 0 && (
                            <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1">
                              <span className="text-[8.5px] font-bold font-mono text-slate-400">Rx:</span>
                              <CodingBadges codes={med.codes} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Referrals & Disposition */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.courseOfAction.referralsSpecialty.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Referrals / Contact specialty</label>
                    <input
                      type="text"
                      value={record.courseOfAction.referralsSpecialty.value}
                      placeholder="e.g. Cardiology consult"
                      onChange={(e) => updateRecordField("courseOfAction", "referralsSpecialty", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none"
                    />
                  </div>

                  <div className={`p-2.5 rounded-lg border-l-4 ${getConfidenceClasses(record.courseOfAction.disposition.confidence).border}`}>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ED Plan / Disposition</label>
                    <input
                      type="text"
                      value={record.courseOfAction.disposition.value ? `${record.courseOfAction.disposition.value} (${record.courseOfAction.dispositionDetails.value || "Ward"})` : ""}
                      placeholder="e.g. Admit to Ward (Ward Name: Stroke ward)"
                      onChange={(e) => updateRecordField("courseOfAction", "disposition", e.target.value)}
                      className="w-full bg-transparent font-medium text-slate-900 border-b border-slate-200 outline-none"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* AI Reasoning box integrated directly in paper design */}
            <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-200 text-[11.5px] text-slate-500">
              <span className="font-bold flex items-center gap-1.5 text-slate-800 uppercase tracking-wide mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
                Clinical Registry Interpreter Log
              </span>
              <p className="leading-relaxed text-slate-600 bg-slate-50 border border-slate-100 p-3 rounded-xl italic">
                {processingReasoning}
              </p>
            </div>

            {/* Interactive footer elements */}
            <div className="mt-6 flex flex-wrap gap-2.5 justify-end">
              <button
                id="toggle-json-dump"
                onClick={() => setShowJsonDump(!showJsonDump)}
                className="text-[11.5px] font-bold px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-sm text-slate-700"
              >
                {showJsonDump ? "Hide Raw Payload" : "View JSON Payload"}
              </button>
              <button
                id="copy-record-payload"
                onClick={handleCopyRecord}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-[11.5px] px-4 py-2 rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedRecord ? "Copied" : "Copy Complete EHR"}
              </button>
            </div>

          </div>

          {/* HL7 FHIR R4 & EHR Compliance Explorer Hub */}
          {showJsonDump && (
            <div className="bg-slate-955 border border-slate-800 p-5 rounded-2xl shadow-2xl flex flex-col gap-4 mt-6 text-white" id="compliance-explorer-hub">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h4 className="text-sm font-bold tracking-wide uppercase text-slate-200">HL7 FHIR R4 & EHR Payload Hub</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Bilingual cross-compatible healthcare standard data outputs</p>
                  </div>
                </div>

                {/* Main toggle */}
                <div className="flex p-0.5 bg-slate-900 rounded-lg border border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setPayloadActiveTab("ehr")}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${payloadActiveTab === "ehr" ? "bg-slate-800 text-indigo-400 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    Structured Scribe JSON
                  </button>
                  <button
                    onClick={() => setPayloadActiveTab("fhir")}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition ${payloadActiveTab === "fhir" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    HL7 FHIR R4 Bundle
                  </button>
                </div>
              </div>

              {payloadActiveTab === "ehr" ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>EHR Payload matches clinical JSON_SCHEMA in promptTemplate.ts</span>
                    </div>
                    <button
                      onClick={handleCopyRecord}
                      className="flex items-center gap-1 text-slate-350 hover:text-white transition bg-slate-800 px-2 py-1 rounded"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedRecord ? "Copied Record" : "Copy Plain JSON"}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-4 bg-slate-900 rounded-xl max-h-96 scrollbar-thin leading-normal border border-slate-850">
                    {JSON.stringify(record, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Interactive FHIR Filters */}
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-850">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-indigo-500 flex items-center justify-center text-[8px] font-bold text-white">R4</span>
                        <span className="font-bold text-slate-200">FHIR R4 Bundle Sandbox Explorer</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyFhir}
                          className="flex items-center gap-1 text-indigo-300 hover:text-teal-250 transition bg-slate-800 px-2 py-1 rounded font-mono"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedFhir ? "Copied FHIR!" : "Copy Bundle"}
                        </button>
                        <button
                          onClick={handleDownloadFhir}
                          className="flex items-center gap-1 text-emerald-300 hover:text-white transition bg-emerald-950 px-2.5 py-1 rounded font-mono font-bold"
                        >
                          <Download className="w-3 h-3" />
                          Download Bundle
                        </button>
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-1 md:gap-1.5 pt-2 border-t border-slate-850">
                      {[
                        { key: "all", display: "All Resources" },
                        { key: "Patient", display: "Patient Details" },
                        { key: "Encounter", display: "Encounter Meta" },
                        { key: "Condition", display: "Diagnoses & Complaints" },
                        { key: "Observation", display: "Vitals & Reports" },
                        { key: "ServiceRequest", display: "Imaging & Lab Orders" },
                        { key: "MedicationRequest", display: "ED Medications" },
                        { key: "Procedure", display: "ED Procedures" }
                      ].map((pill) => {
                        const count = pill.key === "all" 
                          ? generateFhirBundle(record)?.entry?.length || 0
                          : generateFhirBundle(record)?.entry?.filter((e: any) => e.resource && e.resource.resourceType.toLowerCase() === pill.key.toLowerCase()).length || 0;
                        
                        return (
                          <button
                            key={pill.key}
                            onClick={() => setFhirFilter(pill.key)}
                            type="button"
                            className={`px-2 py-0.5 text-[10px] font-semibold font-mono rounded border transition flex items-center gap-1.5 ${
                              fhirFilter === pill.key
                                ? "bg-indigo-600 border-indigo-500 text-white shadow"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-250"
                            }`}
                          >
                            <span>{pill.display}</span>
                            <span className="bg-slate-900 border border-slate-800 px-1 py-0.1 text-[8px] rounded-full text-slate-350 font-mono">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Split display: interactive visual representation + JSON code */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Filtered Entry Cards List */}
                    <div className="lg:col-span-5 flex flex-col gap-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
                      {getFilteredFhirEntries().map((entryNode: any, entryIdx: number) => {
                        const resource = entryNode.resource;
                        if (!resource) return null;
                        
                        return (
                          <div key={entryIdx} className="bg-slate-900 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-1 text-[11px] shadow-sm hover:border-slate-700 transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-wider">{resource.resourceType}</span>
                              <span className="text-[9px] text-slate-500 font-mono">id: {resource.id}</span>
                            </div>
                            
                            {resource.resourceType === "Patient" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Name:</strong> {resource.name?.[0]?.text}</p>
                                <p><strong>DOB/Age:</strong> {resource.birthDate || "No DOB Spoken"} ({record.patientHeader.age.value || "—"} old)</p>
                                <p><strong>Gender:</strong> <span className="capitalize">{resource.gender}</span></p>
                                <p><strong>MRN/UHID:</strong> {resource.identifier?.[0]?.value || "Pending Assignment"}</p>
                              </div>
                            )}

                            {resource.resourceType === "Encounter" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Admitted Priority:</strong> {resource.priority?.text || "Standard Emergency"}</p>
                                <p><strong>Class:</strong> {resource.class?.display || "EMER"}</p>
                                <p><strong>Period Start:</strong> {resource.period?.start || "Immediate"}</p>
                                {resource.hospitalization && (
                                  <p><strong>Discharged Status:</strong> {resource.hospitalization?.dischargeDisposition?.text}</p>
                                )}
                              </div>
                            )}

                            {resource.resourceType === "Condition" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>EHR Clinician Diagnosis:</strong> <span className="italic block mt-0.5 p-1 rounded bg-slate-950 border border-slate-900">"{resource.code?.text}"</span></p>
                                <p className="font-mono text-[9.5px] text-indigo-300">
                                  <strong>HL7 Coding Elements:</strong>
                                </p>
                                {resource.code?.coding && resource.code.coding.length > 0 ? (
                                  resource.code.coding.map((c: any, cIdx: number) => (
                                    <div key={cIdx} className="pl-2 border-l border-indigo-400 py-0.5 text-[9px] font-mono text-slate-400">
                                      {c.system?.includes("icd") ? "ICD-10:" : "SNOMED-CT:"} <span className="text-slate-200 font-bold">{c.code}</span> ({c.display})
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500 italic pl-2">No system codings parsed</span>
                                )}
                              </div>
                            )}

                            {resource.resourceType === "Observation" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Reading Type:</strong> {resource.code?.text}</p>
                                {resource.valueQuantity ? (
                                  <p><strong>Value:</strong> <span className="text-emerald-400 font-bold font-mono">{resource.valueQuantity.value}</span> {resource.valueQuantity.unit}</p>
                                ) : resource.valueString ? (
                                  <p><strong>Findings Details:</strong> <span className="text-slate-250 italic">"{resource.valueString}"</span></p>
                                ) : resource.component ? (
                                  <div className="pl-1.5 border-l border-emerald-500 mt-1 space-y-0.5">
                                    {resource.component.map((comp: any, compIdx: number) => (
                                      <p key={compIdx}>{comp.code?.text || comp.code?.coding?.[0]?.display}: <strong>{comp.valueQuantity?.value || comp.valueString} {comp.valueQuantity?.unit || ""}</strong></p>
                                    ))}
                                  </div>
                                ) : null}
                                <p className="text-[9px] font-mono text-slate-450 mt-1">LOINC Mapped: <span className="text-indigo-400 font-bold font-mono">{resource.code?.coding?.[0]?.code || "N/A"}</span></p>
                              </div>
                            )}

                            {resource.resourceType === "ServiceRequest" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Lab / Imaging Order:</strong> {resource.code?.text}</p>
                                <p><strong>Activity Intent:</strong> <span className="text-amber-400 font-mono font-bold capitalize">{resource.status}</span></p>
                                <p className="text-[8.5px] font-mono text-slate-400 mt-1">
                                  Codes: LOINC <span className="text-slate-300 font-bold">{resource.code?.coding?.[0]?.code || "—"}</span> • CPT <span className="text-indigo-300 font-bold">{resource.code?.coding?.[1]?.code || "—"}</span>
                                </p>
                              </div>
                            )}

                            {resource.resourceType === "MedicationRequest" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Medication Substance:</strong> {resource.medicationCodeableConcept?.text}</p>
                                <p><strong>Dosage instruction:</strong> {resource.dosageInstruction?.[0]?.text}</p>
                                <p className="text-[9px] font-mono text-slate-400">
                                  Standard Coding: RxNorm / ATC <span className="text-indigo-400 font-bold">{resource.medicationCodeableConcept?.coding?.[0]?.code || "Pending mapping"}</span>
                                </p>
                              </div>
                            )}

                            {resource.resourceType === "Procedure" && (
                              <div className="text-slate-300 space-y-0.5 font-sans mt-1">
                                <p><strong>Clinical Procedure:</strong> {resource.code?.text}</p>
                                <p><strong>Status of Procedure:</strong> <span className="text-emerald-400 font-bold font-mono uppercase text-[9px]">{resource.status}</span></p>
                                <p className="text-[9px] font-mono text-slate-400">
                                  Standard Code: CPT / MBS <span className="text-indigo-300 font-bold">{resource.code?.coding?.[0]?.code || "—"}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Code Pre Block */}
                    <div className="lg:col-span-7">
                      <pre className="text-[10px] sm:text-[11px] font-mono text-indigo-200 overflow-x-auto p-4 bg-slate-900 rounded-xl h-[420px] scrollbar-thin leading-relaxed border border-slate-850">
                        {JSON.stringify(getFilteredFhirEntries(), null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </section>
      </div>
    )}
  </div>
</main>

      {/* Unified footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-4 px-6 text-center text-slate-500 text-[11.5px]">
        PiMed Scribe • Crafted with <strong>gemini-3.5-flash</strong> integration and strict clinical verification constraints.
      </footer>
    </div>
  );
}
