import { backUp } from "../data/backupCircuit";
import { moduleList } from "../metadata";

export function getCircuitSummary(scope: unknown = globalScope): string {
  const data = backUp(scope as Parameters<typeof backUp>[0]);
  const lines: string[] = [];
  const scopeObj = scope as { name: string };

  lines.push(`Circuit: "${scopeObj?.name}"`);
  lines.push("");

  const counts: Record<string, number> = {};
  for (const modType of moduleList) {
    const dataArray = data as Record<string, unknown[]>;
    if (dataArray[modType] && dataArray[modType].length > 0) {
      counts[modType] = dataArray[modType].length;
    }
  }
  lines.push("## Elements");
  for (const [type, count] of Object.entries(counts)) {
    lines.push(`- ${type}: ${count}`);
  }
  lines.push("");

  lines.push("## Labeled Elements");
  for (const modType of moduleList) {
    const dataArray = data as Record<string, unknown[]>;
    if (!dataArray[modType]) continue;
    for (const el of dataArray[modType]) {
      const element = el as { label?: string; x: number; y: number; direction?: string; customData?: { constructorParamaters?: unknown[] } };
      if (element.label) {
        const params = element.customData?.constructorParamaters || [];
        const bw = params[params.length - 1] || 1;
        lines.push(
          `- ${modType} "${element.label}" at (${element.x}, ${element.y}), direction: ${element.direction}, bitWidth: ${bw}`,
        );
      }
    }
  }
  lines.push("");

  lines.push("## Connections (node index -> connected indices)");
  const allNodes = (data as { allNodes: Array<{ connections?: number[]; type: number }> }).allNodes;
  const nodeConnections = allNodes
    .map((n, i) => ({
      index: i,
      connections: n.connections,
      type: n.type,
    }))
    .filter((n) => n.connections && n.connections.length > 0);
  for (const n of nodeConnections.slice(0, 50)) {
    lines.push(
      `  Node ${n.index} (type ${n.type}): -> [${n.connections?.join(", ")}]`,
    );
  }
  if (nodeConnections.length > 50) {
    lines.push(`  ... and ${nodeConnections.length - 50} more connections`);
  }

  return lines.join("\n");
}

export function getCircuitJSON(scope: unknown = globalScope): string {
  return JSON.stringify(backUp(scope as Parameters<typeof backUp>[0]));
}

export function getRuntimeState(scope: unknown = globalScope): string {
  const lines: string[] = [];
  lines.push("## Runtime Node Values");

  const scopeObj = scope as { allNodes: Array<{ value?: number; bitWidth: number; parent?: { objectType: string; label?: string } }> };
  for (let i = 0; i < scopeObj.allNodes.length; i++) {
    const node = scopeObj.allNodes[i];
    if (node.value !== undefined) {
      const parent = node.parent?.objectType || "unknown";
      const label = node.parent?.label || "";
      lines.push(
        `  Node ${i}: value=${node.value}, bitWidth=${node.bitWidth}, parent=${parent}${label ? ` "${label}"` : ""}`,
      );
    }
  }

  return lines.join("\n");
}
