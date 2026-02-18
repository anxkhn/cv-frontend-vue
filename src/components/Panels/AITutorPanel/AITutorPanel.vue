<template>
    <div
        class="ai-tutor-panel draggable-panel noSelect defaultCursor"
        v-show="visible"
        ref="panelRef"
    >
        <PanelHeader header-title="AI Tutor" />
        <div class="panel-body">
            <div class="ai-tutor-chat" ref="chatContainer">
                <div
                    v-for="msg in aiTutorStore.messages"
                    :key="msg.timestamp"
                    :class="['chat-message', msg.role]"
                >
                    <div class="message-content" v-html="renderMarkdown(msg.content)"></div>
                </div>
                <div v-if="loading" class="chat-message assistant loading">
                    <div class="spinner"></div>
                    <span>Thinking...</span>
                </div>
            </div>
            <div class="ai-tutor-input">
                <textarea
                    v-model="userInput"
                    placeholder="Ask about your circuit..."
                    rows="2"
                    @keydown.enter.exact.prevent="sendMessage"
                ></textarea>
                <div class="input-actions">
                    <button
                        class="btn btn-xs custom-btn--primary"
                        @click="sendMessage"
                        :disabled="loading || !userInput.trim()"
                    >
                        <i class="fas fa-paper-plane"></i> Send
                    </button>
                    <button
                        class="btn btn-xs custom-btn--tertiary"
                        @click="clearChat"
                        v-if="aiTutorStore.messages.length"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <div v-if="error" class="ai-tutor-error">
                <i class="fas fa-exclamation-triangle"></i> {{ error }}
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick } from "vue";
import PanelHeader from "../Shared/PanelHeader.vue";
import { setupPanelListeners, minimizePanel } from "#/simulator/src/ux";
import { callLLM } from "#/simulator/src/ai/llmClient";
import { ensureAIConfigured } from "#/simulator/src/ai/aiUtils";
import { TUTOR_SYSTEM_PROMPT } from "#/simulator/src/ai/prompts";
import { getCircuitSummary } from "#/simulator/src/ai/circuitSnapshot";
import { useAITutorStore } from "#/store/aiTutorStore";

const aiTutorStore = useAITutorStore();
const visible = ref(true);
const loading = ref(false);
const error = ref("");
const userInput = ref("");
const panelRef = ref<HTMLElement | null>(null);
const chatContainer = ref<HTMLElement | null>(null);

onMounted(() => {
    setupPanelListeners(".ai-tutor-panel");
    minimizePanel(".ai-tutor-panel");
});

async function sendMessage() {
    if (!userInput.value.trim()) return;
    if (!ensureAIConfigured()) return;

    const message = userInput.value.trim();
    userInput.value = "";

    aiTutorStore.addMessage("user", message);
    loading.value = true;
    error.value = "";

    await nextTick();
    scrollToBottom();

    try {
        const circuitContext = getCircuitSummary();

        const conversationHistory = aiTutorStore.messages
            .slice(-10)
            .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
            }));

        const result = await callLLM(
            [
                { role: "system", content: TUTOR_SYSTEM_PROMPT },
                { role: "system", content: `Current circuit state:\n${circuitContext}` },
                ...conversationHistory,
            ],
            { maxTokens: 2048, temperature: 0.4 },
        );

        aiTutorStore.addMessage("assistant", result.content);
        await nextTick();
        scrollToBottom();
    } catch (e: unknown) {
        const err = e as Error;
        if (err.message === "AI_NOT_CONFIGURED") {
            error.value = "Please configure your API key in AI Settings first.";
        } else {
            error.value = err.message || "Failed to get response.";
        }
    } finally {
        loading.value = false;
    }
}

function clearChat() {
    aiTutorStore.clearHistory();
}

function scrollToBottom() {
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
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
.ai-tutor-panel {
    position: absolute;
    top: 60px;
    right: 10px;
    width: 350px;
    max-height: 70vh;
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.ai-tutor-panel .panel-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}
.ai-tutor-chat {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: 40vh;
    padding: 8px;
    background: var(--bg-secondary-color, #f8f9fa);
    border-radius: 4px;
    margin-bottom: 10px;
}
.chat-message {
    margin-bottom: 10px;
    padding: 8px 12px;
    border-radius: 12px;
    max-width: 90%;
    font-size: 13px;
    line-height: 1.4;
}
.chat-message.user {
    background: var(--primary, #42b983);
    color: white;
    margin-left: auto;
    text-align: right;
}
.chat-message.assistant {
    background: var(--bg-primary-color, #fff);
    border: 1px solid var(--br-primary, #e0e0e0);
}
.chat-message.loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #888;
}
.spinner {
    width: 14px;
    height: 14px;
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
.ai-tutor-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ai-tutor-input textarea {
    width: 100%;
    padding: 8px;
    font-size: 13px;
    border: 1px solid var(--br-primary, #ccc);
    border-radius: 4px;
    background: var(--bg-primary-color, #fff);
    color: var(--text-primary, #333);
    resize: none;
}
.input-actions {
    display: flex;
    gap: 8px;
}
.ai-tutor-error {
    color: #e74c3c;
    padding: 8px;
    font-size: 12px;
}
.message-content :deep(code) {
    background: rgba(0, 0, 0, 0.1);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
}
.message-content :deep(ul) {
    padding-left: 16px;
    margin: 4px 0;
}
</style>