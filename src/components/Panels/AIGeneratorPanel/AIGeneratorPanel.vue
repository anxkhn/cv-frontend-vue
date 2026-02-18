<template>
    <div
        class="ai-generator-panel draggable-panel noSelect defaultCursor"
        v-show="visible"
        ref="panelRef"
    >
        <PanelHeader header-title="AI Circuit Generator" />
        <div class="panel-body">
            <div class="ai-gen-input">
                <label>Describe your circuit:</label>
                <textarea
                    v-model="prompt"
                    placeholder="e.g., Build a 4-bit ripple carry adder with carry in and carry out"
                    rows="3"
                    @keydown.ctrl.enter="generateCircuit"
                ></textarea>
                <span class="hint">Ctrl+Enter to generate</span>
            </div>
            <div class="ai-gen-options">
                <label>
                    <input type="checkbox" v-model="replaceCircuit" />
                    Replace current circuit (unchecked = new tab)
                </label>
            </div>
            <div class="ai-gen-controls">
                <button
                    class="btn btn-xs custom-btn--primary"
                    @click="generateCircuit"
                    :disabled="loading || !prompt.trim()"
                >
                    <i class="fas fa-magic"></i>
                    {{ loading ? "Generating..." : "Generate Circuit" }}
                </button>
            </div>
            <div v-if="loading" class="ai-gen-loading">
                <div class="spinner"></div>
                <span>{{ statusText }}</span>
            </div>
            <div v-if="error" class="ai-gen-error">
                <i class="fas fa-exclamation-triangle"></i> {{ error }}
                <button v-if="lastIR" class="btn btn-xs" @click="retryWithError">
                    Retry
                </button>
            </div>
            <div v-if="success" class="ai-gen-success">
                <i class="fas fa-check-circle"></i> Circuit generated successfully!
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";
import PanelHeader from "../Shared/PanelHeader.vue";
import { setupPanelListeners, minimizePanel } from "#/simulator/src/ux";
import { callLLM } from "#/simulator/src/ai/llmClient";
import { ensureAIConfigured } from "#/simulator/src/ai/aiUtils";
import { IR_SCHEMA_PROMPT } from "#/simulator/src/ai/prompts";
import { compileIRToCV } from "#/simulator/src/ai/circuitCompiler";
import load from "#/simulator/src/data/load";
import { type IRCircuit } from "#/simulator/src/ai/circuitIR";

const visible = ref(true);
const loading = ref(false);
const error = ref("");
const success = ref(false);
const prompt = ref("");
const statusText = ref("Generating circuit...");
const replaceCircuit = ref(false);
const lastIR = ref<string>("");
const panelRef = ref<HTMLElement | null>(null);

onMounted(() => {
    setupPanelListeners(".ai-generator-panel");
    minimizePanel(".ai-generator-panel");
});

async function generateCircuit() {
    if (!prompt.value.trim()) return;
    if (!ensureAIConfigured()) return;

    loading.value = true;
    error.value = "";
    success.value = false;
    statusText.value = "Asking AI to design the circuit...";

    try {
        const result = await callLLM(
            [
                { role: "system", content: IR_SCHEMA_PROMPT },
                { role: "user", content: prompt.value },
            ],
            { jsonMode: true, maxTokens: 4096, temperature: 0.2 },
        );

        lastIR.value = result.content;
        statusText.value = "Compiling circuit...";

        let ir: IRCircuit;
        try {
            ir = JSON.parse(result.content);
        } catch {
            throw new Error("LLM returned invalid JSON. Try rephrasing your prompt.");
        }

        if (!ir.elements || !Array.isArray(ir.elements)) {
            throw new Error("Generated circuit has no elements.");
        }
        if (!ir.connections || !Array.isArray(ir.connections)) {
            ir.connections = [];
        }

        const cvJson = compileIRToCV(ir);

        statusText.value = "Loading circuit into simulator...";
        const projectData = JSON.parse(cvJson);
        load(projectData);

        success.value = true;
    } catch (e: unknown) {
        const err = e as Error;
        error.value = err.message || "Failed to generate circuit.";
    } finally {
        loading.value = false;
    }
}

async function retryWithError() {
    if (!ensureAIConfigured()) return;

    loading.value = true;
    error.value = "";
    statusText.value = "Retrying with error feedback...";

    try {
        const result = await callLLM(
            [
                { role: "system", content: IR_SCHEMA_PROMPT },
                { role: "user", content: prompt.value },
                { role: "assistant", content: lastIR.value },
                {
                    role: "user",
                    content: `The previous output had an error: "${error.value}". Please fix it and output corrected JSON only.`,
                },
            ],
            { jsonMode: true, maxTokens: 4096, temperature: 0.1 },
        );

        const ir: IRCircuit = JSON.parse(result.content);
        if (!ir.connections) ir.connections = [];
        const cvJson = compileIRToCV(ir);
        load(JSON.parse(cvJson));
        success.value = true;
    } catch (e: unknown) {
        const err = e as Error;
        error.value = err.message || "Retry failed.";
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.ai-generator-panel {
    position: absolute;
    top: 60px;
    left: 280px;
    width: 380px;
    max-height: 60vh;
    z-index: 100;
}
.ai-gen-input {
    margin-bottom: 10px;
}
.ai-gen-input label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
}
.ai-gen-input textarea {
    width: 100%;
    padding: 8px;
    font-size: 13px;
    border: 1px solid var(--br-primary, #ccc);
    border-radius: 4px;
    background: var(--bg-primary-color, #fff);
    color: var(--text-primary, #333);
    resize: vertical;
}
.hint {
    font-size: 11px;
    color: #999;
}
.ai-gen-options {
    margin-bottom: 10px;
    font-size: 12px;
}
.ai-gen-controls {
    margin-bottom: 10px;
}
.ai-gen-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    color: #888;
    font-size: 13px;
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
.ai-gen-error {
    color: #e74c3c;
    padding: 8px;
    font-size: 13px;
}
.ai-gen-success {
    color: #4caf50;
    padding: 8px;
    font-size: 13px;
}
</style>