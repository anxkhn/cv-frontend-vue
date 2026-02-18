import { useAIStore } from "#/store/aiStore";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export async function callLLM(
  messages: LLMMessage[],
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {},
): Promise<LLMResponse> {
  const store = useAIStore();
  if (!store.isConfigured) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const provider = store.provider;
  const key = store.activeKey;
  const model = store.model;

  switch (provider) {
    case "openai":
      return callOpenAI(key, model, messages, options);
    case "anthropic":
      return callAnthropic(key, model, messages, options);
    case "gemini":
      return callGemini(key, model, messages, options);
    case "xai":
      return callXAI(key, model, messages, options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callOpenAI(
  key: string,
  model: string,
  messages: LLMMessage[],
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  },
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.3,
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

async function callAnthropic(
  key: string,
  model: string,
  messages: LLMMessage[],
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  },
): Promise<LLMResponse> {
  const systemMsgs = messages.filter((m) => m.role === "system");
  const convMsgs = messages.filter((m) => m.role !== "system");

  const systemText = [
    options.systemPrompt || "",
    ...systemMsgs.map((m) => m.content),
  ]
    .filter(Boolean)
    .join("\n\n");

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.3,
    messages: convMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemText) body.system = systemText;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || `Anthropic API error: ${res.status}`,
    );
  }

  const data = await res.json();
  return {
    content: data.content[0].text,
    usage: data.usage
      ? {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
        }
      : undefined,
  };
}

async function callGemini(
  key: string,
  model: string,
  messages: LLMMessage[],
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  },
): Promise<LLMResponse> {
  const systemMsgs = messages.filter((m) => m.role === "system");
  const convMsgs = messages.filter((m) => m.role !== "system");

  const systemInstruction = [
    options.systemPrompt || "",
    ...systemMsgs.map((m) => m.content),
  ]
    .filter(Boolean)
    .join("\n\n");

  const contents = convMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.3,
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (options.jsonMode) {
    (body.generationConfig as Record<string, unknown>).responseMimeType =
      "application/json";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return {
    content: text,
    usage: data.usageMetadata
      ? {
          inputTokens: data.usageMetadata.promptTokenCount || 0,
          outputTokens: data.usageMetadata.candidatesTokenCount || 0,
        }
      : undefined,
  };
}

async function callXAI(
  key: string,
  model: string,
  messages: LLMMessage[],
  options: {
    jsonMode?: boolean;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  },
): Promise<LLMResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.3,
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `xAI API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

export async function streamLLM(
  messages: LLMMessage[],
  onChunk: (text: string) => void,
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {},
): Promise<string> {
  const store = useAIStore();
  if (!store.isConfigured) throw new Error("AI_NOT_CONFIGURED");

  const result = await callLLM(messages, { ...options, jsonMode: false });
  onChunk(result.content);
  return result.content;
}
