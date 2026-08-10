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
    const { transcript } = req.body;

    const currentApiKey = process.env.ANTHROPIC_API_KEY;
    if (!currentApiKey) {
      return res.status(503).json({
        error:
          "EHR Extraction engine is currently unconfigured. Please add your ANTHROPIC_API_KEY in the .env file or your hosting environment.",
      });
    }

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        error: "No transcript text was provided.",
      });
    }

    try {
      const client = getClient();

      console.log("Sending extraction request to claude-sonnet-4-6...");

      const systemText = `${SYSTEM_PROMPT}\n\nYou MUST return raw, parseable JSON matching the following exact JSON schema structure:\n${JSON.stringify(JSON_SCHEMA, null, 2)}\n\nReturn ONLY valid JSON — no markdown fences, no preamble, no commentary.`;

      const response = await (client.messages.create as any)({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        temperature: 0.1,
        // cache_control marks the system prompt as cacheable.
        // Cached tokens are billed at 10% of normal input token cost and
        // do NOT count toward the input token rate limit after the first call.
        system: [
          {
            type: "text",
            text: systemText,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Parse this emergency department conversation / clinical record:\n\n${transcript}`,
          },
        ],
      });

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

      if (error?.status === 429) {
        const retryAfter = error?.headers?.get?.("retry-after") || "60";
        return res.status(429).json({
          error: "Rate limit reached",
          details: `Your API key has hit the 30,000 input tokens/minute limit. Wait ${retryAfter} seconds and try again. To avoid this, upgrade your Anthropic API plan at https://console.anthropic.com/`,
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
