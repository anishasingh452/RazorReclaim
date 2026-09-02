import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export type LlmProviderName = "ollama" | "gemini";

/**
 * Single point of contact with the LLM provider. Every reasoning node goes
 * through this function rather than instantiating a chat model directly —
 * swapping providers (or models) is a config change (LLM_PROVIDER), not a
 * code change. Adding OpenRouter/Anthropic/etc. later means adding one case
 * here; the LangGraph nodes and structured-output schemas stay untouched.
 */
export function getChatModel(temperature = 0.2): BaseChatModel {
  const provider = resolveProvider();

  switch (provider) {
    case "ollama": {
      const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL ?? "qwen3:8b";
      return new ChatOllama({
        baseUrl,
        model,
        temperature,
        // Qwen3 supports an explicit thinking toggle — we want fast, concise
        // structured output, not exposed chain-of-thought.
        think: false,
      }) as unknown as BaseChatModel;
    }
    case "gemini": {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
      if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var");
      return new ChatGoogleGenerativeAI({
        apiKey,
        model,
        temperature,
        maxRetries: 4, // built-in exponential backoff on 429s — see p-retry usage inside @langchain/google-genai
      }) as unknown as BaseChatModel;
    }
  }
}

export function resolveProvider(): LlmProviderName {
  const provider = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
  if (provider !== "ollama" && provider !== "gemini") {
    throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
  return provider;
}

export function currentModelName(): string {
  const provider = resolveProvider();
  const model =
    provider === "ollama"
      ? (process.env.OLLAMA_MODEL ?? "qwen3:8b")
      : (process.env.GEMINI_MODEL ?? "gemini-2.5-flash");
  return `${provider}:${model}`;
}
