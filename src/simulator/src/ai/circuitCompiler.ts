import { type IRCircuit, type IRNode } from "./circuitIR";
import { circuitElementList } from "../metadata";

const PORT_DEFS: Record<string, Record<string, "single" | "array">> = {
  AndGate: { inp: "array", output1: "single" },
  OrGate: { inp: "array", output1: "single" },
  NandGate: { inp: "array", output1: "single" },
  NorGate: { inp: "array", output1: "single" },
  XorGate: { inp: "array", output1: "single" },
  XnorGate: { inp: "array", output1: "single" },
  NotGate: { inp1: "single", output1: "single" },
  Buffer: { inp1: "single", output1: "single" },
  Input: { output1: "single" },
  Output: { inp1: "single" },
  ConstantVal: { output1: "single" },
  Power: { output1: "single" },
  Ground: { output1: "single" },
  Button: { output1: "single" },
  Multiplexer: {
    inp: "array",
    output1: "single",
    controlSignalInput: "single",
  },
  Demultiplexer: {
    output1: "array",
    input: "single",
    controlSignalInput: "single",
  },
  Decoder: { output1: "array", input: "single" },
  DflipFlop: {
    clockInp: "single",
    dInp: "single",
    qOutput: "single",
    qInvOutput: "single",
    reset: "single",
    preset: "single",
    en: "single",
  },
  TflipFlop: {
    clockInp: "single",
    tInp: "single",
    qOutput: "single",
    qInvOutput: "single",
    reset: "single",
    preset: "single",
    en: "single",
  },
  JKflipFlop: {
    clockInp: "single",
    J: "single",
    K: "single",
    qOutput: "single",
    qInvOutput: "single",
    reset: "single",
    preset: "single",
    en: "single",
  },
  SRflipFlop: {
    clockInp: "single",
    S: "single",
    R: "single",
    qOutput: "single",
    qInvOutput: "single",
    reset: "single",
    preset: "single",
    en: "single",
  },
  Dlatch: {
    clockInp: "single",
    dInp: "single",
    qOutput: "single",
    qInvOutput: "single",
  },
  Clock: { output1: "single" },
  DigitalLed: { inp1: "single" },
  HexDisplay: { inp: "single" },
  SevenSegDisplay: { pins: "array" },
  RGBLed: { inp: "array" },
  Adder: {
    inpA: "single",
    inpB: "single",
    carryIn: "single",
    sum: "single",
    carryOut: "single",
  },
  ControlledInverter: {
    inp1: "single",
    output1: "single",
    controlSignalInput: "single",
  },
  TriState: { inp1: "single", output1: "single", state: "single" },
  Splitter: { inp1: "single", outputs: "array" },
  ALU: { inp: "array", output: "single", carryOut: "single" },
  Tunnel: { inp1: "single" },
  Flag: { inp1: "single" },
  BitSelector: { inp1: "single", output1: "single", bitSelectorInp: "single" },
  MSB: { inp1: "single", output1: "single" },
  LSB: { inp1: "single", output1: "single" },
  TwoComplement: { inp1: "single", output1: "single" },
  Random: { output1: "single", maxValue: "single" },
  Counter: {
    output1: "single",
    maxValue: "single",
    clock: "single",
    reset: "single",
    zero: "single",
  },
  Stepper: { output1: "single" },
  VariableLed: { inp1: "single" },
};

function autoLayout(elements: IRNode[]): void {
  const inputs = elements.filter((e) =>
    [
      "Input",
      "Button",
      "Clock",
      "Power",
      "Ground",
      "ConstantVal",
      "Stepper",
      "Random",
      "Counter",
    ].includes(e.type),
  );
  const outputs = elements.filter((e) =>
    [
      "Output",
      "DigitalLed",
      "HexDisplay",
      "SevenSegDisplay",
      "RGBLed",
      "VariableLed",
      "SquareRGBLed",
      "RGBLedMatrix",
      "SixteenSegDisplay",
    ].includes(e.type),
  );
  const middle = elements.filter(
    (e) => !inputs.includes(e) && !outputs.includes(e),
  );

  const X_INPUT = 100;
  const X_MIDDLE = 350;
  const X_OUTPUT = 600;
  const Y_START = 100;
  const Y_SPACING = 80;

  inputs.forEach((el, i) => {
    if (el.x === undefined) el.x = X_INPUT;
    if (el.y === undefined) el.y = Y_START + i * Y_SPACING;
  });

  middle.forEach((el, i) => {
    if (el.x === undefined) el.x = X_MIDDLE + (i % 3) * 120;
    if (el.y === undefined) el.y = Y_START + Math.floor(i / 3) * Y_SPACING;
  });

  outputs.forEach((el, i) => {
    if (el.x === undefined) el.x = X_OUTPUT;
    if (el.y === undefined) el.y = Y_START + i * Y_SPACING;
  });
}

function getConstructorParams(node: IRNode): unknown[] {
  if (node.params) return node.params;

  const dir = node.direction || "RIGHT";
  const bw = node.bitWidth || 1;

  if (
    [
      "AndGate",
      "OrGate",
      "NandGate",
      "NorGate",
      "XorGate",
      "XnorGate",
    ].includes(node.type)
  ) {
    return [dir, 2, bw];
  }
  if (node.type === "Input" || node.type === "Output") {
    return [dir, bw, undefined];
  }
  return [dir, bw];
}

export function compileIRToCV(ir: IRCircuit): string {
  autoLayout(ir.elements);

  for (const el of ir.elements) {
    if (
      !circuitElementList.includes(el.type) &&
      !["Text", "Rectangle", "Arrow", "ImageAnnotation"].includes(el.type)
    ) {
      throw new Error(
        `Unknown element type: ${el.type}. Valid types: ${circuitElementList.join(", ")}`,
      );
    }
  }

  const allNodes: Record<string, unknown>[] = [];
  const portToNodeIndex: Record<string, number> = {};
  const elementPorts: Record<string, Record<string, number | number[]>> = {};

  for (const el of ir.elements) {
    const ports = PORT_DEFS[el.type] || {};
    elementPorts[el.id] = {};

    for (const [portName, portType] of Object.entries(ports)) {
      if (portType === "array") {
        let size = 2;
        if (
          [
            "AndGate",
            "OrGate",
            "NandGate",
            "NorGate",
            "XorGate",
            "XnorGate",
          ].includes(el.type)
        ) {
          const params = el.params as unknown[] | undefined;
          size = (params?.[1] as number) || 2;
        }
        const indices: number[] = [];
        for (let i = 0; i < size; i++) {
          const idx = allNodes.length;
          allNodes.push({
            x: 0,
            y: 0,
            type: 0,
            bitWidth: el.bitWidth || 1,
            label: "",
            connections: [],
          });
          portToNodeIndex[`${el.id}.${portName}.${i}`] = idx;
          indices.push(idx);
        }
        elementPorts[el.id][portName] = indices;
      } else {
        const idx = allNodes.length;
        const isOutput =
          portName.toLowerCase().includes("output") ||
          portName === "sum" ||
          portName === "carryOut" ||
          portName === "qOutput" ||
          portName === "qInvOutput" ||
          (el.type === "Input" && portName === "output1") ||
          (el.type === "Clock" && portName === "output1");
        allNodes.push({
          x: 0,
          y: 0,
          type: isOutput ? 1 : 0,
          bitWidth: el.bitWidth || 1,
          label: "",
          connections: [],
        });
        portToNodeIndex[`${el.id}.${portName}`] = idx;
        elementPorts[el.id][portName] = idx;
      }
    }
  }

  for (const conn of ir.connections) {
    const fromIdx = resolvePortRef(conn.from, portToNodeIndex);
    const toIdx = resolvePortRef(conn.to, portToNodeIndex);

    if (fromIdx === undefined || toIdx === undefined) {
      console.warn(`Cannot resolve connection: ${conn.from} -> ${conn.to}`);
      continue;
    }

    const fromNode = allNodes[fromIdx] as { connections: number[] };
    const toNode = allNodes[toIdx] as { connections: number[] };
    if (!fromNode.connections.includes(toIdx)) {
      fromNode.connections.push(toIdx);
    }
    if (!toNode.connections.includes(fromIdx)) {
      toNode.connections.push(fromIdx);
    }
  }

  const moduleArrays: Record<string, unknown[]> = {};

  for (const el of ir.elements) {
    if (!moduleArrays[el.type]) moduleArrays[el.type] = [];

    const ports = elementPorts[el.id] || {};
    const nodesObj: Record<string, unknown> = {};

    for (const [portName, value] of Object.entries(ports)) {
      nodesObj[portName] = value;
    }

    moduleArrays[el.type].push({
      x: Math.round((el.x || 200) / 10) * 10,
      y: Math.round((el.y || 200) / 10) * 10,
      objectType: el.type,
      label: el.label || "",
      direction: el.direction || "RIGHT",
      labelDirection: "LEFT",
      propagationDelay: 10,
      customData: {
        constructorParamaters: getConstructorParams(el),
        nodes: nodesObj,
        values: el.values || {},
      },
    });
  }

  const scope: Record<string, unknown> = {
    id: 0,
    name: ir.name || "Main",
    allNodes,
    ...moduleArrays,
  };

  const project = {
    name: ir.name || "Generated Circuit",
    timePeriod: 500,
    clockEnabled: true,
    projectId: "0",
    focussedCircuit: 0,
    orderedTabs: ["0"],
    scopes: [scope],
  };

  return JSON.stringify(project);
}

function resolvePortRef(
  ref: string,
  portMap: Record<string, number>,
): number | undefined {
  if (portMap[ref] !== undefined) return portMap[ref];

  const parts = ref.split(".");
  if (parts.length === 2) {
    const withIndex = `${ref}.0`;
    if (portMap[withIndex] !== undefined) return portMap[withIndex];
  }

  return undefined;
}
