import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";

export type AIProvider = "openai" | "anthropic" | "gemini" | "xai";

export interface AIProviderConfig {
  id: AIProvider;
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
}

export interface AIUsageInfo {
  monthlyBudget: number;
  currentUsage: number;
  remainingBudget: number;
  usagePercentage: number;
  budgetExceeded: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  usagePeriodStart: string | null;
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5",
    models: [
      "gpt-5.3",
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5",
      "o3-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4.6",
    models: [
      "claude-opus-4.6",
      "claude-sonnet-4.6",
      "claude-haiku-4.5",
    ],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3-flash-preview",
    models: [
      "gemini-3-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ],
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4-latest",
    models: [
      "grok-4-latest",
      "grok-4-0709",
      "grok-3",
      "grok-3-mini",
    ],
  },
};

const STORAGE_KEY = "cv_ai_settings";
const BYOK_MODE_KEY = "cv_ai_byok_mode";

interface PersistedSettings {
  provider: AIProvider;
  keys: Partial<Record<AIProvider, string>>;
  model: string;
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: "openai", keys: {}, model: "gpt-4o" };
}

const API_BASE = "/api/v1";

export const useAIStore = defineStore("aiStore", () => {
  const saved = loadSettings();

  const provider = ref<AIProvider>(saved.provider);
  const keys = ref<Partial<Record<AIProvider, string>>>(saved.keys);
  const model = ref<string>(saved.model);
  const byokMode = ref<boolean>(
    localStorage.getItem(BYOK_MODE_KEY) !== "false"
  );
  const usageInfo = ref<AIUsageInfo | null>(null);
  const isAuthenticated = ref<boolean>(false);
  const serverKeys = ref<Partial<Record<AIProvider, boolean>>>({});

  const activeKey = computed(() => {
    if (byokMode.value) {
      return keys.value[provider.value] || "";
    }
    return "";
  });

  const activeProvider = computed(() => AI_PROVIDERS[provider.value]);

  const isConfigured = computed(() => {
    if (byokMode.value) {
      return activeKey.value.length > 0;
    }
    return serverKeys.value[provider.value] === true;
  });

  const budgetExceeded = computed(() => {
    if (byokMode.value) return false;
    return usageInfo.value?.budgetExceeded ?? false;
  });

  function setProvider(p: AIProvider) {
    provider.value = p;
    model.value = AI_PROVIDERS[p].defaultModel;
    persist();
  }

  function setKey(p: AIProvider, key: string) {
    keys.value = { ...keys.value, [p]: key };
    persist();
  }

  function setModel(m: string) {
    model.value = m;
    persist();
  }

  function setByokMode(enabled: boolean) {
    byokMode.value = enabled;
    localStorage.setItem(BYOK_MODE_KEY, String(enabled));
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        provider: provider.value,
        keys: keys.value,
        model: model.value,
      }),
    );
  }

  async function fetchServerSettings(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/ai_settings/status`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        isAuthenticated.value = true;

        const newServerKeys: Partial<Record<AIProvider, boolean>> = {};
        for (const p of data.providers || []) {
          newServerKeys[p.provider as AIProvider] = p.enabled && !p.budget_exceeded;
        }
        serverKeys.value = newServerKeys;
      } else {
        isAuthenticated.value = false;
      }
    } catch {
      isAuthenticated.value = false;
    }
  }

  async function fetchUsage(providerParam?: AIProvider): Promise<AIUsageInfo | null> {
    const targetProvider = providerParam || provider.value;
    try {
      const response = await fetch(
        `${API_BASE}/ai_settings/${targetProvider}/usage`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        usageInfo.value = {
          monthlyBudget: data.monthly_budget,
          currentUsage: data.current_usage,
          remainingBudget: data.remaining_budget,
          usagePercentage: data.usage_percentage,
          budgetExceeded: data.budget_exceeded,
          totalInputTokens: data.total_input_tokens,
          totalOutputTokens: data.total_output_tokens,
          usagePeriodStart: data.usage_period_start,
        };
        return usageInfo.value;
      }
    } catch {}
    return null;
  }

  async function saveKeyToServer(
    p: AIProvider,
    apiKey: string,
    monthlyBudget?: number
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/ai_settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_setting: {
            provider: p,
            api_key: apiKey,
            model: model.value,
            monthly_budget: monthlyBudget ?? 5.0,
            byok_mode: false,
          },
        }),
      });

      if (response.ok) {
        serverKeys.value = { ...serverKeys.value, [p]: true };
        return true;
      }
    } catch {}
    return false;
  }

  async function updateBudget(p: AIProvider, budget: number): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/ai_settings/${p}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_setting: { monthly_budget: budget },
        }),
      });

      if (response.ok && usageInfo.value) {
        usageInfo.value.monthlyBudget = budget;
        return true;
      }
    } catch {}
    return false;
  }

  watch([provider, keys, model], persist, { deep: true });

  return {
    provider,
    keys,
    model,
    byokMode,
    usageInfo,
    isAuthenticated,
    serverKeys,
    activeKey,
    activeProvider,
    isConfigured,
    budgetExceeded,
    setProvider,
    setKey,
    setModel,
    setByokMode,
    fetchServerSettings,
    fetchUsage,
    saveKeyToServer,
    updateBudget,
  };
});
