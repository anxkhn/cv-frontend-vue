import { defineStore } from "pinia";
import { ref } from "vue";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const useAITutorStore = defineStore("aiTutorStore", () => {
  const messages = ref<ChatMessage[]>([]);
  const isOpen = ref(false);

  function addMessage(role: "user" | "assistant", content: string) {
    messages.value.push({ role, content, timestamp: Date.now() });
  }

  function clearHistory() {
    messages.value = [];
  }

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  return { messages, isOpen, addMessage, clearHistory, toggle };
});
