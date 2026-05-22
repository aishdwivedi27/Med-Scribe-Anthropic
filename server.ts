/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PiMed-Scribe — Anthropic Claude backend
 * Replaces the original Google Gemini implementation.
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, JSON_SCHEMA } from "./src/promptTemplate.js";

// Load environment variables
dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not defined. AI transcription services will activate once the key is set."
  );
}

// Anthropic client — lazily initialised per request so a key set after startup is picked up.
function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function parseJSONRobustly(text: string): any {
  if (!text) {
    throw new Error("Empty response received from the Claude clinical model.");
  }

  const cleaned = text.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e: any) {
    console.warn("Direct JSON parsing failed. Attempting robust cleanup...", e.message);

    let stripped = cleaned;
    if (stripped.startsWith("```")) {
      stripped = stripped.replace(/^```[a-zA-Z0-9]*\s*/, "");
    }
    if (stripped.endsWith("```")) {
      stripped = stripped.replace(/\s*```$/, "");
    }
    stripped = stripped.trim();

    try {
      return JSON.parse(stripped);
    } catch {
      const startIndex = stripped.indexOf("{");
      const endIndex = stripped.lastIndexOf("}");

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const potentialJson = stripped.substring(startIndex, endIndex + 1);
        try {
          return JSON.parse(potentialJson);
        } catch (substringErr: any) {
          console.error("Substring parsing failed. Substring was:", potentialJson);
          throw new Error(
            `Failing with SyntaxError during custom EHR parsing. Original error: ${e.message}. Extract error: ${substringErr.message}`
          );
        }
      }
      throw e;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      apiConfigured: !!process.env.ANTHROPIC_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // Core transcription and clinical extraction endpoint
  app.post("/api/transcribe", async (req, res) => {
    const { transcript, audio, mimeType } = req.body;

    const currentApiKey = process.env.ANTHROPIC_API_KEY;
    if (!currentApiKey) {
      return res.status(503).json({
        error:
          "EHR Extraction engine is currently unconfigured. Please add your ANTHROPIC_API_KEY in the .env file or your hosting environment.",
      });
    }

    try {
      const client = getClient();

      // Build the user message content array.
      // Claude supports audio as base64 via the messages API.
      const userContent: Anthropic.MessageParam["content"] = [];

      if (audio) {
        // Supported audio media types for Claude: audio/webm, audio/ogg, audio/wav, audio/mp4
        const resolvedMimeType =
          (mimeType as string) || "audio/webm";

        userContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: resolvedMimeType as "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mp4",
            data: audio,
          },
        } as any); // cast needed because audio document type is newer in the SDK

        userContent.push({
          type: "text",
          text: `Evaluate this recorded clinical session. Extract all clinical headings into the provided EHR structure. If some data is not conversed, keep it blank with confidence 'none'. Perform the raw transcription automatically.\nUser context:\n${transcript || ""}`,
        });
      } else if (transcript) {
        userContent.push({
          type: "text",
          text: `Parse this emergency department conversation / clinical record:\n\n${transcript}`,
        });
      } else {
        return res.status(400).json({
          error: "No transcript text or recorded voice audio was provided.",
        });
      }

      console.log("Sending extraction request to claude-sonnet-4-20250514...");

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        temperature: 0.1,
        system: `${SYSTEM_PROMPT}\n\nYou MUST return raw, parseable JSON matching the following exact JSON schema structure:\n${JSON.stringify(JSON_SCHEMA, null, 2)}\n\nReturn ONLY valid JSON — no markdown fences, no preamble, no commentary.`,
        messages: [{ role: "user", content: userContent }],
      });

      // Extract text from the response
      const rawText = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as Anthropic.TextBlock).text)
        .join("");

      if (!rawText) {
        throw new Error("No response string received from the Claude model.");
      }

      console.log("Successfully retrieved model response. Formatting payload...");
      const extractedData = parseJSONRobustly(rawText);
      return res.json(extractedData);
    } catch (error: any) {
      console.error("Transcription operation failed:", error);

      const isInvalidKey =
        error?.status === 401 ||
        error?.message?.includes("invalid_api_key") ||
        error?.message?.includes("authentication_error");

      if (isInvalidKey) {
        return res.status(401).json({
          error: "Invalid Anthropic API Key",
          details:
            "The Anthropic API returned an authentication error. Check that ANTHROPIC_API_KEY in your .env file is correct and active.",
        });
      }

      return res.status(500).json({
        error: "EHR Extraction Failed",
        details: error.message || error,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EHR Service running on port ${PORT}`);
  });
}

startServer();
