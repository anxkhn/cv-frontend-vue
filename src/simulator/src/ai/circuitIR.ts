export interface IRNode {
  id: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  direction?: string;
  bitWidth?: number;
  params?: unknown[];
  values?: Record<string, unknown>;
}

export interface IRConnection {
  from: string;
  to: string;
}

export interface IRCircuit {
  name?: string;
  elements: IRNode[];
  connections: IRConnection[];
}
