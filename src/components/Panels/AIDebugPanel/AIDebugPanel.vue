<template>
    <div
        class="ai-debug-panel draggable-panel noSelect defaultCursor"
        v-show="visible"
        ref="panelRef"
    >
        <PanelHeader header-title="AI Circuit Debugger" />
        <div class="panel-body">
            <div class="ai-debug-controls">
                <button
                    class="btn btn-xs custom-btn--primary"
                    @click="debugCircuit"
                    :disabled="loading"
                >
                    <i class="fas fa-bug"></i>
                    {{ loading ? "Debugging..." : "Debug Circuit" }}
                </button>
            </div>
            <div class="ai-debug-context">
                <label>What did you expect?</label>
                <textarea
                    v-model="expectedBehavior"
                    placeholder="e.g., Output should be 1 when both inputs are 1, but it shows 0"
                    rows="2"
                ></textarea>
            </div>
            <div v-if="currentErrors.length" class="ai-debug-errors">
                <strong>Detected errors:</strong>
                <div v-for="err in currentErrors" :key="err" class="error-chip">
                    <i class="fas fa-exclamation-circle"></i> {{ err }}
                </div>
            </div>
            <div v-if="loading" class="ai-debug-loading">
                <div class="spinner"></div>
                <span>Analyzing circuit behavior...</span>
            </div>
            <div v-if="error" class="ai-debug-error-msg">
                <i class="fas fa-exclamation-triangle"></i> {{ error }}
            </div>
            <div
                v-if="diagnosis"
                class="ai-debug-result"
                v-html="renderMarkdown(diagnosis)"
            ></div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from "vue";
import PanelHeader from "../Shared/PanelHeader.vue";
import { setupPanelListeners, minimizePanel } from "#/simulator/src/ux";
import { callLLM } from "#/simulator/src/ai/llmClient";
import { ensureAIConfigured } from "#/simulator/src/ai/aiUtils";
import {
    getCircuitSummary,
    getCircuitJSON,
    getRuntimeState,
} from "#/simulator/src/ai/circuitSnapshot";
import { DEBUG_SYSTEM_PROMPT } from "#/simulator/src/ai/prompts";
import { useState } from "#/store/SimulatorStore/state";

const simulatorState = useState();
const visible = ref(true);
const loading = ref(false);
const error = ref("");
const diagnosis = ref("");
const expectedBehavior = ref("");
const panelRef = ref<HTMLElement | null>(null);

const currentErrors = computed(() => simulatorState.errorMessages || []);

onMounted(() => {
    setupPanelListeners(".ai-debug-panel");
    minimizePanel(".ai-debug-panel");
});

async function debugCircuit() {
    if (!ensureAIConfigured()) return;

    loading.value = true;
    error.value = "";

    try {
        const circuitData = getCircuitJSON();
        const runtimeState = getRuntimeState();
        const errors = currentErrors.value.join("\n");

        const userMessage = [
            "Please debug this circuit.",
            "",
            expectedBehavior.value
                ? `**Expected behavior:** ${expectedBehavior.value}`
                : "",
            errors
                ? `**Current errors:** ${errors}`
                : "**No errors detected, but behavior may be unexpected.**",
            "",
            "## Circuit Data",
            circuitData.length > 15000 ? getCircuitSummary() : circuitData,
            "",
            "## Runtime State",
            runtimeState,
        ]
            .filter(Boolean)
            .join("\n");

        const result = await callLLM(
            [
                { role: "system", content: DEBUG_SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
            { maxTokens: 2048, temperature: 0.2 },
        );

        diagnosis.value = result.content;
    } catch (e: unknown) {
        const err = e as Error;
        if (err.message === "AI_NOT_CONFIGURED") {
            error.value = "Please configure your API key in AI Settings first.";
        } else {
            error.value = err.message || "Failed to debug circuit.";
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
.ai-debug-panel {
    position: absolute;
    top: 60px;
    right: 400px;
    width: 380px;
    max-height: 70vh;
    z-index: 100;
    overflow: hidden;
}
.ai-debug-controls {
    margin-bottom: 10px;
}
.ai-debug-context {
    margin-bottom: 10px;
}
.ai-debug-context label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
}
.ai-debug-context textarea {
    width: 100%;
    padding: 6px;
    font-size: 12px;
    border: 1px solid var(--br-primary, #ccc);
    border-radius: 4px;
    background: var(--bg-primary-color, #fff);
    color: var(--text-primary, #333);
    resize: vertical;
}
.ai-debug-errors {
    margin-bottom: 10px;
}
.error-chip {
    display: inline-block;
    padding: 2px 8px;
    margin: 2px;
    background: #ffebee;
    color: #c62828;
    border-radius: 12px;
    font-size: 11px;
}
.ai-debug-loading {
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
.ai-debug-error-msg {
    color: #e74c3c;
    padding: 8px;
    font-size: 13px;
}
.ai-debug-result {
    max-height: 45vh;
    overflow-y: auto;
    font-size: 13px;
    line-height: 1.5;
    padding: 10px;
    background: var(--bg-secondary-color, #f8f9fa);
    border-radius: 4px;
}
</style>
