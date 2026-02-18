import { useState } from "#/store/SimulatorStore/state";

type PanelType = "settings" | "explain" | "debug" | "generator" | "tutor";

export function openAIPanel(panel: PanelType): void {
    const simulatorState = useState();

    switch (panel) {
        case "settings":
            simulatorState.dialogBox.ai_settings_dialog = true;
            break;
        case "explain":
            const explainPanel = document.querySelector(
                ".ai-explain-panel"
            ) as HTMLElement;
            if (explainPanel) {
                explainPanel.style.display = "block";
                const body = explainPanel.querySelector(
                    ".panel-body"
                ) as HTMLElement;
                const maximize = explainPanel.querySelector(
                    ".maximize"
                ) as HTMLElement;
                if (body) body.style.display = "block";
                if (maximize) maximize.style.display = "none";
            }
            break;
        case "debug":
            const debugPanel = document.querySelector(
                ".ai-debug-panel"
            ) as HTMLElement;
            if (debugPanel) {
                debugPanel.style.display = "block";
                const body = debugPanel.querySelector(
                    ".panel-body"
                ) as HTMLElement;
                const maximize = debugPanel.querySelector(
                    ".maximize"
                ) as HTMLElement;
                if (body) body.style.display = "block";
                if (maximize) maximize.style.display = "none";
            }
            break;
        case "generator":
            const generatorPanel = document.querySelector(
                ".ai-generator-panel"
            ) as HTMLElement;
            if (generatorPanel) {
                generatorPanel.style.display = "block";
                const body = generatorPanel.querySelector(
                    ".panel-body"
                ) as HTMLElement;
                const maximize = generatorPanel.querySelector(
                    ".maximize"
                ) as HTMLElement;
                if (body) body.style.display = "block";
                if (maximize) maximize.style.display = "none";
            }
            break;
        case "tutor":
            const tutorPanel = document.querySelector(
                ".ai-tutor-panel"
            ) as HTMLElement;
            if (tutorPanel) {
                tutorPanel.style.display = "block";
                const body = tutorPanel.querySelector(
                    ".panel-body"
                ) as HTMLElement;
                const maximize = tutorPanel.querySelector(
                    ".maximize"
                ) as HTMLElement;
                if (body) body.style.display = "block";
                if (maximize) maximize.style.display = "none";
            }
            break;
    }
}
