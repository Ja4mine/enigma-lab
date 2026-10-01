/** Local inspection state; never contains or mutates encryption history. */
export type Assembly =
  "drive" | "rotor" | "reflector" | "plug" | "key" | "housing";
export interface ComponentInspection {
  assembly: Assembly;
  rotorIndex: 0 | 1 | 2;
  isolate: string;
  spread: number;
  progress: number;
  showWiring: boolean;
  wire: number;
  /** A fixed-window experiment, independent of the live machine configuration. */
  ringExperiment: boolean;
  trialRing: number | null;
  probeInput: number;
  scenario: "current" | "right" | "carry" | "double";
}
export function createInspection(
  assembly: Assembly,
  rotorIndex: 0 | 1 | 2 = 2,
): ComponentInspection {
  return {
    assembly,
    rotorIndex,
    isolate: "all",
    spread: 0,
    progress: 0,
    showWiring: true,
    wire: -1,
    ringExperiment: true,
    trialRing: null,
    probeInput: 0,
    scenario: "current",
  };
}
