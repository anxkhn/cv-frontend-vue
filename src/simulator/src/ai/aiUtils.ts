import { useAIStore } from "#/store/aiStore";

export function ensureAIConfigured(): boolean {
  const store = useAIStore();
  if (store.isConfigured) return true;

  import("#/store/SimulatorStore/state").then(({ useState }) => {
    const simulatorState = useState();
    simulatorState.dialogBox.ai_settings_dialog = true;
  });
  return false;
}

export function showAIError(message: string): void {
  import("#/store/SimulatorStore/state").then(({ useState }) => {
    const simulatorState = useState();
    simulatorState.errorMessages.push(message);
    setTimeout(() => {
      const idx = simulatorState.errorMessages.indexOf(message);
      if (idx > -1) simulatorState.errorMessages.splice(idx, 1);
    }, 5000);
  });
}
