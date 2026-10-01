import {
  cloneConfig,
  plugboardMapping,
  validateConfig,
  type MachineConfig,
  type RotorId,
} from "./enigma";

export type RotorDraftField = "rotors" | "positions" | "rings";

/**
 * Edit one rotor slot without creating two copies of the same physical rotor.
 * Reusing an installed rotor swaps the two rotor models; window and ring values
 * stay with their slots. An unfinished plugboard draft must not block this edit.
 */
export function updateRotorDraft(
  config: MachineConfig,
  field: RotorDraftField,
  index: 0 | 1 | 2,
  value: RotorId | number,
): MachineConfig {
  if (!Number.isInteger(index) || index < 0 || index > 2) {
    throw new Error("转子槽位必须是 0、1 或 2。");
  }
  validateConfig({ ...config, plugboard: "" });
  const next = cloneConfig(config);
  if (field === "rotors") {
    const other = next.rotors.indexOf(value as RotorId);
    if (other !== -1 && other !== index) {
      next.rotors[other] = next.rotors[index];
    }
    next.rotors[index] = value as RotorId;
  } else if (field === "positions" || field === "rings") {
    next[field][index] = value as number;
  } else {
    throw new Error("请选择转子型号、窗口位置或环设置。");
  }
  // Reuse the engine's runtime type and range checks. Deliberately retain the
  // original plugboard text, even when the user has only typed half a pair.
  validateConfig({ ...next, plugboard: "" });
  return next;
}

/**
 * A geometry-only snapshot of pending settings. An incomplete/invalid plugboard
 * keeps the last applied connections visible until its draft is valid. This
 * never steps the machine, applies a setting, or rewrites an existing trace.
 */
export function previewConfig(
  draft: MachineConfig,
  applied: MachineConfig,
): MachineConfig {
  validateConfig(applied);
  validateConfig({ ...draft, plugboard: "" });
  const preview = cloneConfig(draft);
  try {
    plugboardMapping(draft.plugboard);
  } catch {
    preview.plugboard = applied.plugboard;
  }
  return preview;
}
