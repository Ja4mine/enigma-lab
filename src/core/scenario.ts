/**
 * The intercepted message used by the Bombe walkthrough. The key is "hidden"
 * only in the sense that the walkthrough never reads it: every step recovers
 * information from the ciphertext and the crib, and the tests check that the
 * Bombe finds this key again.
 */
import { ALPHABET, encryptText, type MachineConfig, type RotorId, type Triple } from "./enigma";
import { WHEEL_ORDERS, buildMenu, turnoverInside } from "./bombe";

export interface Scenario {
  /** Luftwaffe-style weather report, X as word separator. */
  plaintext: string;
  crib: string;
  /** Where the crib really sits; the walkthrough must find it by dragging. */
  cribOffset: number;
  key: MachineConfig;
  ciphertext: string;
}

const PLAINTEXT =
  "ANXLUFTFLOTTEXDREIXWETTERVORHERSAGEFUERDENRAUMCHERBOURGXBEDECKTXWINDWESTSTAERKEFUENFXSICHTACHTKILOMETERXREGENSCHAUERXLUFTDRUCKFALLENDXGEZXMETEOROLOGE";
const CRIB = "WETTERVORHERSAGE";

function withCipher(base: Omit<Scenario, "ciphertext">): Scenario {
  return { ...base, ciphertext: encryptText(base.key, base.plaintext).ciphertext };
}

/** IV–V–III, UKW B, rings 24·14·17, start ACK, ten plugs (E↔P among them). */
export const DEFAULT_SCENARIO: Scenario = withCipher({
  plaintext: PLAINTEXT,
  crib: CRIB,
  cribOffset: PLAINTEXT.indexOf(CRIB),
  key: {
    rotors: ["IV", "V", "III"],
    reflector: "B",
    positions: [0, 2, 10],
    rings: [23, 13, 16],
    plugboard: "AT BX CM DI EP HJ NR OS QU WY",
  },
});

/**
 * A fresh random key for the same report. Keys are rejected when the middle
 * rotor would turn inside the crib (the Bombe's model would be wrong there) or
 * the menu has fewer than two closures.
 */
export function randomScenario(seed: number): Scenario {
  let state = seed >>> 0 || 1;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const cribOffset = PLAINTEXT.indexOf(CRIB);
  for (let attempt = 0; attempt < 500; attempt++) {
    const letters = [...ALPHABET];
    for (let i = 25; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const plugboard = Array.from({ length: 10 }, (_, k) =>
      [letters[2 * k], letters[2 * k + 1]].sort().join(""),
    )
      .sort()
      .join(" ");
    const key: MachineConfig = {
      rotors: [...WHEEL_ORDERS[Math.floor(rand() * WHEEL_ORDERS.length)]] as Triple<RotorId>,
      reflector: "B",
      positions: [0, 0, 0].map(() => Math.floor(rand() * 26)) as Triple<number>,
      rings: [0, 0, 0].map(() => Math.floor(rand() * 26)) as Triple<number>,
      plugboard,
    };
    if (turnoverInside(key, cribOffset, CRIB.length)) continue;
    const scenario = withCipher({ plaintext: PLAINTEXT, crib: CRIB, cribOffset, key });
    const menu = buildMenu(CRIB, scenario.ciphertext.slice(cribOffset, cribOffset + CRIB.length));
    if (menu.closures >= 2) return scenario;
  }
  return DEFAULT_SCENARIO;
}
