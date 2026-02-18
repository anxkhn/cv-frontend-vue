<template>
    <v-dialog v-model="dialogState.ai_settings_dialog" :persistent="false">
        <v-card class="messageBoxContent ai-settings-dialog">
            <v-card-text>
                <p class="dialogHeader">AI Settings</p>
                <v-btn
                    size="x-small"
                    icon
                    class="dialogClose"
                    @click="dialogState.ai_settings_dialog = false"
                >
                    <v-icon>mdi-close</v-icon>
                </v-btn>
                <div class="ai-settings-body">
                    <!-- Mode Toggle -->
                    <div class="ai-settings-field">
                        <label>Key Storage Mode</label>
                        <div class="mode-toggle">
                            <button
                                :class="['mode-btn', { active: aiStore.byokMode }]"
                                @click="aiStore.setByokMode(true)"
                            >
                                <i class="fas fa-user-shield"></i> BYOK (Browser)
                            </button>
                            <button
                                :class="['mode-btn', { active: !aiStore.byokMode }]"
                                @click="aiStore.setByokMode(false)"
                                :disabled="!aiStore.isAuthenticated"
                            >
                                <i class="fas fa-server"></i> Server Storage
                            </button>
                        </div>
                        <p class="mode-note" v-if="!aiStore.isAuthenticated && !aiStore.byokMode">
                            <i class="fas fa-info-circle"></i> Log in to use server storage with budget tracking
                        </p>
                    </div>

                    <!-- BYOK Mode Note -->
                    <p class="ai-settings-note" v-if="aiStore.byokMode">
                        <i class="fas fa-shield-alt"></i>
                        BYOK: Your API keys are stored only in your browser's localStorage. They are never sent to CircuitVerse servers.
                    </p>

                    <!-- Budget Warning -->
                    <div v-if="!aiStore.byokMode && aiStore.budgetExceeded" class="budget-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        Monthly budget exceeded. AI features disabled until next billing period or budget increase.
                    </div>

                    <!-- Provider Selection -->
                    <div class="ai-settings-field">
                        <label>Provider</label>
                        <select :value="aiStore.provider" @change="onProviderChange">
                            <option v-for="p in providers" :key="p.id" :value="p.id">
                                {{ p.label }}
                            </option>
                        </select>
                    </div>

                    <!-- API Key Input (BYOK or Server) -->
                    <div class="ai-settings-field" v-if="aiStore.byokMode || !hasServerKey">
                        <label>API Key</label>
                        <div class="key-input-wrapper">
                            <input
                                :type="showKey ? 'text' : 'password'"
                                :value="aiStore.byokMode ? aiStore.activeKey : newServerKey"
                                @input="onKeyInput"
                                placeholder="Paste your API key here"
                            />
                            <span
                                :class="showKey ? 'fas fa-eye-slash' : 'fas fa-eye'"
                                class="toggle-key"
                                @click="showKey = !showKey"
                            ></span>
                        </div>
                        <button
                            v-if="!aiStore.byokMode && newServerKey"
                            class="btn btn-xs btn-save-key"
                            @click="saveKeyToServer"
                            :disabled="savingKey"
                        >
                            {{ savingKey ? 'Saving...' : 'Save to Server' }}
                        </button>
                    </div>

                    <!-- Server Key Status -->
                    <div v-if="!aiStore.byokMode && hasServerKey" class="server-key-status">
                        <i class="fas fa-check-circle"></i> API key stored securely on server
                        <button class="btn btn-xs btn-change-key" @click="showKeyInput = true">
                            Change
                        </button>
                    </div>

                    <!-- Budget Settings (Server Mode) -->
                    <div v-if="!aiStore.byokMode && usageInfo" class="budget-section">
                        <label>Monthly Budget (USD)</label>
                        <div class="budget-input-wrapper">
                            <span class="budget-currency">$</span>
                            <input
                                type="number"
                                step="0.50"
                                min="0"
                                max="1000"
                                :value="usageInfo.monthlyBudget"
                                @change="onBudgetChange"
                            />
                        </div>
                        <div class="budget-progress">
                            <div class="budget-bar">
                                <div
                                    class="budget-fill"
                                    :style="{ width: Math.min(usageInfo.usagePercentage, 100) + '%' }"
                                    :class="{ exceeded: usageInfo.budgetExceeded }"
                                ></div>
                            </div>
                            <div class="budget-labels">
                                <span>${{ usageInfo.currentUsage.toFixed(4) }} used</span>
                                <span>${{ usageInfo.remainingBudget.toFixed(2) }} remaining</span>
                            </div>
                        </div>
                        <div class="budget-tokens">
                            Tokens: {{ formatTokens(usageInfo.totalInputTokens) }} in / 
                            {{ formatTokens(usageInfo.totalOutputTokens) }} out
                        </div>
                    </div>

                    <!-- Model Selection -->
                    <div class="ai-settings-field">
                        <label>Model</label>
                        <select :value="aiStore.model" @change="onModelChange">
                            <option
                                v-for="m in aiStore.activeProvider.models"
                                :key="m"
                                :value="m"
                            >
                                {{ m }}
                            </option>
                        </select>
                    </div>

                    <!-- Status -->
                    <div class="ai-settings-status">
                        <span v-if="aiStore.isConfigured" class="status-ok">
                            <i class="fas fa-check-circle"></i> Key configured for
                            {{ aiStore.activeProvider.label }}
                        </span>
                        <span v-else class="status-missing">
                            <i class="fas fa-exclamation-triangle"></i> No API key set
                        </span>
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from "vue";
import { useAIStore, AI_PROVIDERS, type AIProvider } from "#/store/aiStore";
import { useState } from "#/store/SimulatorStore/state";

const aiStore = useAIStore();
const simulatorState = useState();
const showKey = ref(false);
const showKeyInput = ref(false);
const newServerKey = ref("");
const savingKey = ref(false);
const providers = Object.values(AI_PROVIDERS);

const dialogState = computed(() => simulatorState.dialogBox);

const hasServerKey = computed(() => aiStore.serverKeys[aiStore.provider] === true);
const usageInfo = computed(() => aiStore.usageInfo);

onMounted(async () => {
    await aiStore.fetchServerSettings();
    if (!aiStore.byokMode) {
        await aiStore.fetchUsage();
    }
});

watch(() => aiStore.provider, async () => {
    if (!aiStore.byokMode) {
        await aiStore.fetchUsage();
    }
    showKeyInput.value = false;
    newServerKey.value = "";
});

watch(() => aiStore.byokMode, async (isByok) => {
    if (!isByok) {
        await aiStore.fetchUsage();
    }
});

function onProviderChange(e: Event) {
    aiStore.setProvider((e.target as HTMLSelectElement).value as AIProvider);
}

function onKeyInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (aiStore.byokMode) {
        aiStore.setKey(aiStore.provider, value);
    } else {
        newServerKey.value = value;
    }
}

function onModelChange(e: Event) {
    aiStore.setModel((e.target as HTMLSelectElement).value);
}

async function saveKeyToServer() {
    if (!newServerKey.value.trim()) return;
    savingKey.value = true;
    const success = await aiStore.saveKeyToServer(aiStore.provider, newServerKey.value);
    savingKey.value = false;
    if (success) {
        newServerKey.value = "";
        showKeyInput.value = false;
        await aiStore.fetchUsage();
    }
}

async function onBudgetChange(e: Event) {
    const budget = parseFloat((e.target as HTMLInputElement).value) || 0;
    await aiStore.updateBudget(aiStore.provider, budget);
}

function formatTokens(tokens: number): string {
    if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + "M";
    if (tokens >= 1000) return (tokens / 1000).toFixed(1) + "K";
    return String(tokens);
}
</script>

<style scoped>
.ai-settings-dialog {
    min-width: 450px;
}
.ai-settings-body {
    padding: 10px 0;
}
.ai-settings-note {
    font-size: 12px;
    color: #888;
    margin-bottom: 16px;
    padding: 8px;
    background: var(--bg-secondary-color, #f5f5f5);
    border-radius: 4px;
}
.mode-toggle {
    display: flex;
    gap: 8px;
}
.mode-btn {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--br-primary, #ccc);
    border-radius: 4px;
    background: var(--bg-primary-color, #fff);
    color: var(--text-primary, #333);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}
.mode-btn.active {
    background: var(--primary, #42b983);
    color: white;
    border-color: var(--primary, #42b983);
}
.mode-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.mode-note {
    font-size: 11px;
    color: #ff9800;
    margin-top: 6px;
}
.budget-warning {
    background: #fff3cd;
    color: #856404;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 12px;
}
.ai-settings-field {
    margin-bottom: 14px;
}
.ai-settings-field label {
    display: block;
    font-size: 13px;
    margin-bottom: 4px;
    font-weight: 600;
}
.ai-settings-field select,
.ai-settings-field input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--br-primary, #ccc);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-primary-color, #fff);
    color: var(--text-primary, #333);
}
.key-input-wrapper {
    position: relative;
}
.key-input-wrapper input {
    padding-right: 35px;
}
.toggle-key {
    cursor: pointer;
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #888;
}
.btn-save-key {
    margin-top: 6px;
    background: var(--primary, #42b983);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
}
.server-key-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #e8f5e9;
    border-radius: 4px;
    font-size: 12px;
    color: #2e7d32;
}
.btn-change-key {
    margin-left: auto;
    background: transparent;
    border: 1px solid #4caf50;
    color: #4caf50;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
}
.budget-section {
    margin-bottom: 14px;
    padding: 12px;
    background: var(--bg-secondary-color, #f8f9fa);
    border-radius: 4px;
}
.budget-section label {
    display: block;
    font-size: 13px;
    margin-bottom: 6px;
    font-weight: 600;
}
.budget-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 10px;
}
.budget-currency {
    font-size: 14px;
    color: var(--text-primary, #333);
}
.budget-input-wrapper input {
    width: 100px;
    padding: 6px 8px;
    font-size: 14px;
}
.budget-bar {
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
}
.budget-fill {
    height: 100%;
    background: #4caf50;
    transition: width 0.3s;
}
.budget-fill.exceeded {
    background: #f44336;
}
.budget-labels {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #666;
    margin-top: 4px;
}
.budget-tokens {
    font-size: 11px;
    color: #888;
    margin-top: 6px;
}
.status-ok {
    color: #4caf50;
    font-size: 13px;
}
.status-missing {
    color: #ff9800;
    font-size: 13px;
}
</style>
