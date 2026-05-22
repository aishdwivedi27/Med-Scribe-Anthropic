# PiMed-Scribe

An AI-powered clinical transcription tool for emergency departments. PiMed-Scribe listens to clinical conversations, extracts structured EHR data, and maps findings to standard medical codes (ICD-10, SNOMED-CT, LOINC, CPT, MBS, RxNorm) — all in real time.

Supports typed transcripts, preset case scripts, and live voice recording with browser-side speech transcription via the Web Speech API.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your Anthropic API key:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set:
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```
   Get your key at [console.anthropic.com](https://console.anthropic.com/).

3. Start the app:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

- **Text input:** Paste or type a clinical conversation and click Extract.
- **Presets:** Choose from built-in ED case scripts to test the extraction pipeline.
- **Voice recording:** Speech is transcribed live in the browser using the Web Speech API. The resulting text goes to the Express backend, which sends it to `claude-sonnet-4-20250514` for structured EHR extraction with confidence scores on every field.

## Build for Production

```bash
npm run build
npm start
```

## Browser Support Caveat

Voice recording uses the browser's built-in **Web Speech API**. This works in **Chrome and Edge** but is not supported in Firefox or Safari on most platforms.

If you need cross-browser voice support, replace the `SpeechRecognition` block in `src/App.tsx` with a third-party speech-to-text service such as [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text) or [Deepgram](https://developers.deepgram.com/). The rest of the pipeline (text to Claude for EHR extraction) stays the same.
