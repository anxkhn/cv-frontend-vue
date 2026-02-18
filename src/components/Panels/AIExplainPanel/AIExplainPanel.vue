<template>
    <div
        class="ai-explain-panel draggable-panel noSelect defaultCursor"
        v-show="visible"
        ref="panelRef"
    >
        <PanelHeader header-title="AI Circuit Explainer" />
        <div class="panel-body">
            <div class="ai-explain-controls">
                <button
                    class="btn btn-xs custom-btn--primary"
                    @click="explainCircuit"
                    :disabled="loading"
                >
                    <i class="fas fa-lightbulb"></i>
                    {{ loading ? "Explaining..." : "Explain This Circuit" }}
                </button>
                <button
                    v-if="explanation"
                    class="btn btn-xs custom-btn--tertiary"
                    @click="explanation = ''"
                >
                    Clear
                </button>
            </div>
            <div v-if="loading" class="ai-explain-loading">
                <div class="spinner"></div>
                <span>Analyzing circuit structure...</span>
            </div>
            <div v-if="error" class="ai-explain-error">
                <i class="fas fa-exclamation-triangle"></i> {{ error }}
            </div>
            <div
                v-if="explanation"
                class="ai-explain-result"
                v-html="renderMarkdown(explanation)"
            ></div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import PanelHeader from "../Shared/PanelHeader.vue";
import { setupPanelListeners, minimizePanel } from "#/simulator/src/ux";
import { callLLM } from "#/simulator/src/ai/llmClient";
import { ensureAIConfigured } from "#/simulator/src/ai/aiUtils";
import {
    getCircuitSummary,
    getCircuitJSON,
} from "#/simulator/src/ai/circuitSnapshot";
import { EXPLAIN_SYSTEM_PROMPT } from "#/simulator/src/ai/prompts";

const visible = ref(true);
const loading = ref(false);
const error = ref("");
const explanation = ref("");
const panelRef = ref<HTMLElement | null>(null);

onMounted(() => {
    setupPanelListeners(".ai-explain-panel");
    minimizePanel(".ai-explain-panel");
});

async function explainCircuit() {
    if (!ensureAIConfigured()) return;

    loading.value = true;
    error.value = "";

    try {
        const summary = getCircuitSummary();
        const json = getCircuitJSON();

        const circuitData = json.length > 15000 ? summary : json;

        const result = await callLLM(
            [
                { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Please explain the following circuit:\n\n${circuitData}`,
                },
            ],
            { maxTokens: 2048, temperature: 0.3 },
        );

        explanation.value = result.content;
    } catch (e: unknown) {
        const err = e as Error;
        if (err.message === "AI_NOT_CONFIGURED") {
            error.value = "Please configure your API key in AI Settings first.";
        } else {
            error.value = err.message || "Failed to generate explanation.";
        }
    } finally {
        loading.value = false;
    }
}

function renderMarkdown(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/^### (.+)$/gm, "<h4>$1</h4>")
        .replace(/^## (.+)$/gm, "<h3>$1</h3>")
        .replace(/^# (.+)$/gm, "<h2>$1</h2>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/\n{2,}/g, "</p><p>")
        .replace(/\n/g, "<br>")
        .replace(/^/, "<p>")
        .replace(/$/, "</p>");
}
</script>

<style scoped>
.ai-explain-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 380px;
    max-height: 70vh;
    z-index: 100;
    overflow: hidden;
}
.ai-explain-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}
.ai-explain-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    color: #888;
}
.spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #ccc;
    border-top: 2px solid #333;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
.ai-explain-error {
    color: #e74c3c;
    padding: 8px;
    font-size: 13px;
}
.ai-explain-result {
    max-height: 50vh;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.5;
    padding: 10px;
    background: var(--bg-secondary-color, #f8f9fa);
    border-radius: 4px;
}
.ai-explain-result :deep(h2),
.ai-explain-result :deep(h3),
.ai-explain-result :deep(h4) {
    margin: 12px 0 6px;
}
.ai-explain-result :deep(code) {
    background: var(--bg-primary-color, #e9ecef);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
}
.ai-explain-result :deep(ul) {
    padding-left: 20px;
}
.ai-explain-result :deep(li) {
    margin: 2px 0;
}
</style>
