# PiMed-Scribe

An AI-powered clinical transcription tool for emergency departments. PiMed-Scribe listens to clinical conversations, extracts structured EHR data, and maps findings to standard medical codes (ICD-10, SNOMED-CT, LOINC, CPT, MBS, RxNorm) — all in real time.

Supports typed transcripts, preset case scripts, and live voice recording with automatic audio transcription via Claude.

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
- **Voice recording:** Record a live clinical session; audio is sent to the backend and transcribed by Claude automatically.

The Express backend sends audio or text to `claude-sonnet-4-20250514`, which returns a structured JSON record with confidence scores for every field.

## Build for Production

```bash
npm run build
npm start
```
