/**
 * Turing–Welchman Bombe logic, independent of any rendering.
 *
 * Notation (all letters zero-based, A = 0):
 *   S        plugboard (Steckerbrett), an involution
 *   E_i      unsteckered scrambler (rotors + reflector + rotors back) used for
 *            crib letter i; also an involution with no fixed point
 *   p_i, c_i crib (plain) letter and cipher letter at crib index i
 *
 * Enigma enciphers c_i = S·E_i·S(p_i). Because S = S⁻¹ this is equivalent to
 *   S(c_i) = E_i(S(p_i)),
 * a relation that no longer mentions the 150-trillion plugboard choices except
 * as the unknown values S(letter). A menu chains these relations; the Bombe
 * tests every scrambler position for a contradiction.
 *
 * Positions here are rotor *core* offsets (window − ring), because the wiring
 * only sees that difference. The Bombe therefore never needs ring settings.
 * Convention: `core` is the offset triple (left, middle, right) at the moment the
 * FIRST crib letter is enciphered; crib letter i uses (left, middle, right + i).
 * This assumes no middle-rotor turnover inside the crib, as the real menus did.
 */
import {
  ALPHABET,
  REFLECTORS,
  ROTORS,
  mod26,
  type MachineConfig,
  type ReflectorId,
  type RotorId,
  type Triple,
} from "./enigma";

export const ROTOR_IDS: readonly RotorId[] = ["I", "II", "III", "IV", "V"];
export const POSITIONS = 26 * 26 * 26;

export const WHEEL_ORDERS: readonly Triple<RotorId>[] = (() => {
  const orders: Triple<RotorId>[] = [];
  for (const a of ROTOR_IDS)
    for (const b of ROTOR_IDS)
      for (const c of ROTOR_IDS)
        if (a !== b && b !== c && a !== c) orders.push([a, b, c]);
  return orders;
})();

const idx = (ch: string) => ALPHABET.indexOf(ch);

/* ------------------------------------------------------------------ */
/* Scrambler                                                           */
/* ------------------------------------------------------------------ */

/** Inner part x → M⁻¹ L⁻¹ U L M (x), entered from the middle rotor's right side. */
function innerPermutation(
  left: RotorId,
  middle: RotorId,
  reflector: ReflectorId,
  l: number,
  m: number,
  out: Uint8Array,
): Uint8Array {
  const L = ROTORS[left],
    M = ROTORS[middle],
    U = REFLECTORS[reflector].contacts;
  for (let x = 0; x < 26; x++) {
    let s = mod26(M.forward[mod26(x + m)] - m);
    s = mod26(L.forward[mod26(s + l)] - l);
    s = U[s];
    s = mod26(L.reverse[mod26(s + l)] - l);
    s = mod26(M.reverse[mod26(s + m)] - m);
    out[x] = s;
  }
  return out;
}

function outerPermutation(
  right: RotorId,
  inner: Uint8Array,
  r: number,
  out: Uint8Array,
): Uint8Array {
  const R = ROTORS[right];
  for (let x = 0; x < 26; x++) {
    const a = mod26(R.forward[mod26(x + r)] - r);
    out[x] = mod26(R.reverse[mod26(inner[a] + r)] - r);
  }
  return out;
}

/** Unsteckered Enigma scrambler E at core offsets (left, middle, right). */
export function scrambler(
  rotors: Triple<RotorId>,
  reflector: ReflectorId,
  core: Triple<number>,
): Uint8Array {
  const inner = innerPermutation(
    rotors[0],
    rotors[1],
    reflector,
    mod26(core[0]),
    mod26(core[1]),
    new Uint8Array(26),
  );
  return outerPermutation(rotors[2], inner, mod26(core[2]), new Uint8Array(26));
}

/** Window positions and rings → core offsets the wiring actually sees. */
export const coreOf = (config: Pick<MachineConfig, "positions" | "rings">) =>
  config.positions.map((p, i) => mod26(p - config.rings[i])) as Triple<number>;

/* ------------------------------------------------------------------ */
/* Fast Enigma (no trace) used for checking and for ring-setting search */
/* ------------------------------------------------------------------ */

export function plugMap(pairs: string): Uint8Array {
  const map = new Uint8Array(26).map((_, i) => i);
  for (const pair of pairs.trim().toUpperCase().split(/\s+/).filter(Boolean)) {
    const a = idx(pair[0]),
      b = idx(pair[1]);
    if (a < 0 || b < 0) continue;
    map[a] = b;
    map[b] = a;
  }
  return map;
}

/** Same rules as `encryptText` (step first, double-step) without traces. */
export function fastEnigma(
  config: MachineConfig,
  text: string,
  plug: Uint8Array = plugMap(config.plugboard),
): string {
  const [L, M, R] = config.rotors.map((id) => ROTORS[id]);
  const U = REFLECTORS[config.reflector].contacts;
  let [pl, pm, pr] = config.positions;
  const [rl, rm, rr] = config.rings;
  let out = "";
  for (const ch of text) {
    const x0 = idx(ch);
    if (x0 < 0) continue;
    const midNotch = M.notches.includes(pm),
      rightNotch = R.notches.includes(pr);
    if (midNotch) pl = mod26(pl + 1);
    if (midNotch || rightNotch) pm = mod26(pm + 1);
    pr = mod26(pr + 1);
    const ol = pl - rl,
      om = pm - rm,
      or = pr - rr;
    let s = plug[x0];
    s = mod26(R.forward[mod26(s + or)] - or);
    s = mod26(M.forward[mod26(s + om)] - om);
    s = mod26(L.forward[mod26(s + ol)] - ol);
    s = U[s];
    s = mod26(L.reverse[mod26(s + ol)] - ol);
    s = mod26(M.reverse[mod26(s + om)] - om);
    s = mod26(R.reverse[mod26(s + or)] - or);
    out += ALPHABET[plug[s]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Crib dragging                                                       */
/* ------------------------------------------------------------------ */

/** Crib indices whose letter equals the cipher letter beneath: impossible. */
export function crashes(cipher: string, crib: string, offset: number): number[] {
  const hits: number[] = [];
  for (let i = 0; i < crib.length; i++)
    if (cipher[offset + i] === crib[i]) hits.push(i);
  return hits;
}

export function cribOffsets(cipher: string, crib: string) {
  const result: { offset: number; crashes: number[] }[] = [];
  for (let offset = 0; offset + crib.length <= cipher.length; offset++)
    result.push({ offset, crashes: crashes(cipher, crib, offset) });
  return result;
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

export interface MenuLink {
  /** Crib index; the scrambler for this link is set to offset +index. */
  index: number;
  plain: number;
  cipher: number;
}

export interface MenuLoop {
  /** Letters around the closed path, first letter repeated implicitly. */
  letters: number[];
  /** Link indices (into `links`) in path order. */
  links: number[];
}

export interface Menu {
  crib: string;
  segment: string;
  links: MenuLink[];
  /** Distinct letters, sorted. */
  letters: number[];
  degree: number[];
  /** Shortest independent closed paths (a minimum cycle basis). */
  loops: MenuLoop[];
  /** Number of independent closures: links − letters + parts. */
  closures: number;
  components: number[][];
  /** Test-register letter: the best-connected letter of the largest part. */
  input: number;
}

export function buildMenu(crib: string, segment: string): Menu {
  if (crib.length !== segment.length)
    throw new Error("crib and cipher segment must have equal length");
  const links: MenuLink[] = [];
  for (let i = 0; i < crib.length; i++) {
    const plain = idx(crib[i]),
      cipher = idx(segment[i]);
    if (plain < 0 || cipher < 0) throw new Error("crib must be A–Z only");
    if (plain === cipher) throw new Error(`crash at crib index ${i}`);
    links.push({ index: i, plain, cipher });
  }
  const degree = new Array<number>(26).fill(0);
  for (const link of links) {
    degree[link.plain]++;
    degree[link.cipher]++;
  }
  const letters = degree.flatMap((d, letter) => (d ? [letter] : []));

  const adjacency = new Map<number, { to: number; link: number }[]>();
  links.forEach((link, i) => {
    for (const [a, b] of [
      [link.plain, link.cipher],
      [link.cipher, link.plain],
    ]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a)!.push({ to: b, link: i });
    }
  });
  // Connected parts of the menu.
  const seen = new Set<number>();
  const components: number[][] = [];
  for (const start of letters) {
    if (seen.has(start)) continue;
    const component: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const a = queue.shift()!;
      component.push(a);
      for (const { to } of adjacency.get(a) ?? [])
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
    }
    components.push(component.sort((x, y) => x - y));
  }
  const closures = links.length - letters.length + components.length;
  const loops = shortestLoops(letters, adjacency, closures);
  const largest = components.reduce((best, c) => (c.length > best.length ? c : best), []);
  const input = largest.reduce((best, x) => (degree[x] > degree[best] ? x : best), largest[0]);
  return { crib, segment, links, letters, degree, loops, closures, components, input };
}

/**
 * Independent closed paths, shortest first (a minimum cycle basis over GF(2)).
 * Menus are small, so all simple cycles up to ten letters are enumerated.
 */
function shortestLoops(
  letters: number[],
  adjacency: Map<number, { to: number; link: number }[]>,
  wanted: number,
): MenuLoop[] {
  const cycles: MenuLoop[] = [];
  const keys = new Set<string>();
  for (const start of letters) {
    const path = [start],
      edges: number[] = [],
      onPath = new Set([start]);
    const walk = (u: number) => {
      if (cycles.length > 4000) return;
      for (const { to, link } of adjacency.get(u) ?? []) {
        if (edges.length && link === edges[edges.length - 1]) continue;
        if (to === start && edges.length >= 1) {
          const loopLinks = [...edges, link];
          const key = [...loopLinks].sort((a, b) => a - b).join(",");
          if (!keys.has(key)) {
            keys.add(key);
            cycles.push({ letters: [...path], links: loopLinks });
          }
          continue;
        }
        if (to < start || onPath.has(to) || path.length >= 10) continue;
        path.push(to);
        edges.push(link);
        onPath.add(to);
        walk(to);
        path.pop();
        edges.pop();
        onPath.delete(to);
      }
    };
    walk(start);
  }
  cycles.sort((a, b) => a.links.length - b.links.length);
  const basis: { pivot: bigint; vector: bigint }[] = [];
  const chosen: MenuLoop[] = [];
  for (const cycle of cycles) {
    if (chosen.length >= wanted) break;
    let v = cycle.links.reduce((acc, l) => acc ^ (1n << BigInt(l)), 0n);
    for (const b of basis) if (v & b.pivot) v ^= b.vector;
    if (!v) continue;
    let pivot = 1n;
    while (pivot <= v) pivot <<= 1n;
    pivot >>= 1n;
    basis.push({ pivot, vector: v });
    // Highest pivot first keeps the elimination exact.
    basis.sort((a, b) => (a.pivot > b.pivot ? -1 : a.pivot < b.pivot ? 1 : 0));
    chosen.push(cycle);
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* The Bombe                                                           */
/* ------------------------------------------------------------------ */

export interface BombeSpec {
  rotors: Triple<RotorId>;
  reflector: ReflectorId;
  menu: Menu;
  /** Welchman's diagonal board: hypothesis a↔b is the same wire as b↔a. */
  diagonal: boolean;
  /** Wire of the test register that receives the voltage. */
  inputWire: number;
}

export interface BombeStop {
  /** Run index: top drums fastest (left rotor), bottom drums slowest. */
  index: number;
  core: Triple<number>;
  /** Live wires of the test register as a 26-bit mask. */
  live: number;
  count: number;
}

/** Run index → core offsets. Top drum = Enigma left rotor and turns fastest. */
export const coreAt = (index: number): Triple<number> => [
  index % 26,
  Math.floor(index / 26) % 26,
  Math.floor(index / 676) % 26,
];
export const indexOf = (core: Triple<number>) =>
  mod26(core[0]) + 26 * mod26(core[1]) + 676 * mod26(core[2]);

/** Unordered hypothesis pair a↔x → node id (351 nodes incl. self-steckers). */
const PAIR = (() => {
  const table = new Int16Array(26 * 26);
  let n = 0;
  for (let a = 0; a < 26; a++)
    for (let b = a; b < 26; b++) {
      table[a * 26 + b] = n;
      table[b * 26 + a] = n;
      n++;
    }
  return table;
})();
const PAIR_NODES = 351;

const popcount = (v: number) => {
  let c = 0;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
};

/**
 * Electrical evaluation of one drum position by union–find: wires that are
 * connected through scramblers (and the diagonal board) carry the same current.
 */
export class BombeEvaluator {
  readonly spec: BombeSpec;
  private readonly bundle = new Int16Array(26).fill(-1);
  private readonly parent: Int16Array;
  private readonly identity: Int16Array;
  private readonly links: { a: number; b: number; index: number }[];
  private readonly inner = new Uint8Array(26);
  private readonly perms: Uint8Array[];
  private cachedLM = -1;

  constructor(spec: BombeSpec) {
    this.spec = spec;
    spec.menu.letters.forEach((letter, i) => (this.bundle[letter] = i));
    const nodes = spec.diagonal ? PAIR_NODES : spec.menu.letters.length * 26;
    this.parent = new Int16Array(nodes);
    this.identity = new Int16Array(nodes).map((_, i) => i);
    this.links = spec.menu.links.map((link) => ({
      a: link.plain,
      b: link.cipher,
      index: link.index,
    }));
    const span = Math.max(1, ...spec.menu.links.map((l) => l.index + 1));
    this.perms = Array.from({ length: span }, () => new Uint8Array(26));
  }

  private node(letter: number, wire: number): number {
    return this.spec.diagonal ? PAIR[letter * 26 + wire] : this.bundle[letter] * 26 + wire;
  }

  private find(x: number): number {
    const p = this.parent;
    while (p[x] !== x) {
      p[x] = p[p[x]];
      x = p[x];
    }
    return x;
  }

  private prepare(core: Triple<number>) {
    const lm = core[0] * 26 + core[1];
    if (lm !== this.cachedLM) {
      innerPermutation(
        this.spec.rotors[0],
        this.spec.rotors[1],
        this.spec.reflector,
        core[0],
        core[1],
        this.inner,
      );
      this.cachedLM = lm;
    }
    for (let i = 0; i < this.perms.length; i++)
      outerPermutation(this.spec.rotors[2], this.inner, mod26(core[2] + i), this.perms[i]);
  }

  /** Connects all wires; returns the live mask of the test register. */
  evaluate(core: Triple<number>): { live: number; count: number } {
    this.prepare(core);
    const parent = this.parent;
    parent.set(this.identity);
    const diagonal = this.spec.diagonal;
    const links = this.links;
    // Hot loop: inline union–find with path halving, one variant per mode.
    for (let k = 0; k < links.length; k++) {
      const link = links[k];
      const perm = this.perms[link.index];
      if (diagonal) {
        const baseA = link.a * 26,
          baseB = link.b * 26;
        for (let x = 0; x < 26; x++) {
          let ra = PAIR[baseA + x],
            rb = PAIR[baseB + perm[x]];
          while (parent[ra] !== ra) ra = parent[ra] = parent[parent[ra]];
          while (parent[rb] !== rb) rb = parent[rb] = parent[parent[rb]];
          if (ra !== rb) parent[ra] = rb;
        }
      } else {
        const baseA = this.bundle[link.a] * 26,
          baseB = this.bundle[link.b] * 26;
        for (let x = 0; x < 26; x++) {
          let ra = baseA + x,
            rb = baseB + perm[x];
          while (parent[ra] !== ra) ra = parent[ra] = parent[parent[ra]];
          while (parent[rb] !== rb) rb = parent[rb] = parent[parent[rb]];
          if (ra !== rb) parent[ra] = rb;
        }
      }
    }
    const input = this.spec.menu.input;
    const root = this.find(this.node(input, this.spec.inputWire));
    let live = 0;
    for (let x = 0; x < 26; x++) if (this.find(this.node(input, x)) === root) live |= 1 << x;
    return { live, count: popcount(live) };
  }

  /** Scrambler permutation used by a link at the last evaluated position. */
  permutationFor(core: Triple<number>, cribIndex: number): Uint8Array {
    this.prepare(core);
    return this.perms[cribIndex].slice();
  }
}

/** Incremental run so the UI can animate the drums and stay responsive. */
export class BombeRun {
  readonly evaluator: BombeEvaluator;
  readonly stops: BombeStop[] = [];
  index = 0;
  constructor(spec: BombeSpec) {
    this.evaluator = new BombeEvaluator(spec);
  }
  get done() {
    return this.index >= POSITIONS;
  }
  /**
   * Tests up to `budget` positions; returns stops found in this slice. With
   * `haltAtStop` it stops right after the first stop, like the real machine.
   */
  advance(budget: number, haltAtStop = false): BombeStop[] {
    const found: BombeStop[] = [];
    const end = Math.min(POSITIONS, this.index + budget);
    while (this.index < end) {
      const core = coreAt(this.index);
      const { live, count } = this.evaluator.evaluate(core);
      this.index++;
      if (count < 26) {
        const stop = { index: this.index - 1, core, live, count };
        this.stops.push(stop);
        found.push(stop);
        if (haltAtStop) break;
      }
    }
    return found;
  }
  runToEnd() {
    while (!this.done) this.advance(4096);
    return this.stops;
  }
}

/* ------------------------------------------------------------------ */
/* Current propagation, for drawing                                    */
/* ------------------------------------------------------------------ */

export type Via = "inject" | "scrambler" | "diagonal";
export interface LitWire {
  letter: number;
  wire: number;
  layer: number;
  via: Via;
  /** Link (crib index) or diagonal partner that carried the current. */
  link?: number;
  from?: { letter: number; wire: number };
}

/**
 * Breadth-first spread of current from one test-register wire through ordered
 * wires (letter, wire). Each layer is one more relay hop; the result can be
 * replayed to show the current moving through the menu.
 */
export function propagate(
  spec: BombeSpec,
  core: Triple<number>,
  start: { letter: number; wire: number } = {
    letter: spec.menu.input,
    wire: spec.inputWire,
  },
): { lit: LitWire[]; masks: number[] } {
  const evaluator = new BombeEvaluator(spec);
  const perms = spec.menu.links.map((link) => ({
    link,
    perm: evaluator.permutationFor(core, link.index),
  }));
  const inMenu = new Set(spec.menu.letters);
  const masks = new Array<number>(26).fill(0);
  const lit: LitWire[] = [];
  const queue: LitWire[] = [];
  const visit = (cell: LitWire) => {
    if (masks[cell.letter] & (1 << cell.wire)) return;
    masks[cell.letter] |= 1 << cell.wire;
    lit.push(cell);
    queue.push(cell);
  };
  visit({ ...start, layer: 0, via: "inject" });
  while (queue.length) {
    const cell = queue.shift()!;
    for (const { link, perm } of perms) {
      const other =
        link.plain === cell.letter ? link.cipher : link.cipher === cell.letter ? link.plain : -1;
      if (other < 0) continue;
      visit({
        letter: other,
        wire: perm[cell.wire],
        layer: cell.layer + 1,
        via: "scrambler",
        link: link.index,
        from: { letter: cell.letter, wire: cell.wire },
      });
    }
    if (spec.diagonal && cell.letter !== cell.wire) {
      // Only menu letters have scramblers attached, but the diagonal board
      // has a jack for every letter, so current may pass through any of them.
      visit({
        letter: cell.wire,
        wire: cell.letter,
        layer: cell.layer + 1,
        via: "diagonal",
        from: { letter: cell.letter, wire: cell.wire },
      });
    }
    void inMenu;
  }
  return { lit, masks };
}

/* ------------------------------------------------------------------ */
/* Stop analysis and checking                                          */
/* ------------------------------------------------------------------ */

export interface Hypothesis {
  /** Candidate stecker partner of the test-register letter. */
  wire: number;
  /** No letter receives two different stecker values. */
  consistent: boolean;
  /** letter → implied partner, for every letter the current reached. */
  steckers: Map<number, number>;
}

/** All 26 hypotheses for the test letter at a stop, each traced separately. */
export function analyseStop(spec: BombeSpec, core: Triple<number>): Hypothesis[] {
  const out: Hypothesis[] = [];
  for (let wire = 0; wire < 26; wire++) {
    const { masks } = propagate(spec, core, { letter: spec.menu.input, wire });
    let consistent = true;
    const steckers = new Map<number, number>();
    masks.forEach((mask, letter) => {
      if (!mask) return;
      if (popcount(mask) > 1) consistent = false;
      else steckers.set(letter, 31 - Math.clz32(mask));
    });
    // An involution: if a→b then b→a must not point elsewhere.
    if (consistent)
      for (const [a, b] of steckers)
        if (steckers.has(b) && steckers.get(b) !== a) consistent = false;
    out.push({ wire, consistent, steckers });
  }
  return out;
}

/** Plugboard text from implied pairs (self-steckers omitted). */
export function steckerText(steckers: Map<number, number>): string {
  const seen = new Set<number>();
  const pairs: string[] = [];
  for (const [a, b] of [...steckers].sort((x, y) => x[0] - y[0])) {
    if (a === b || seen.has(a) || seen.has(b)) continue;
    seen.add(a);
    seen.add(b);
    pairs.push(ALPHABET[Math.min(a, b)] + ALPHABET[Math.max(a, b)]);
  }
  return pairs.sort().join(" ");
}

/* German plausibility, used to recover ring settings and leftover steckers. */
const WORDS =
  "WETTER VORHERSAGE WIND NORD SUED OST WEST STAERKE BEDECKT HEITER REGEN SCHAUER SICHT KILOMETER METER GRAD NULL EINS ZWO DREI VIER FUENF SECHS SIEBEN ACHT NEUN ZEHN UHR HEUTE MORGEN NACHT ABEND LUFT DRUCK FALLEND STEIGEND NEBEL WOLKEN HOCH TIEF RAUM FUER DEN DER DIE DAS UND VON AUF MIT BIS NACH KEINE BESONDEREN EREIGNISSE LUFTFLOTTE GESCHWADER STAFFEL FLIEGER KORPS DIVISION ANGRIFF FEIND EIGENE LAGE MELDUNG BEFEHL KANAL KUESTE SEEGANG BEOBACHTER BODEN TEMPERATUR AUFKLAERUNG FLUGPLATZ ZEIT STUNDE GEZ".split(
    " ",
  );
const BIGRAMS = new Set(
  "ER EN CH DE EI TE IN ND IE GE ST NE BE ES UN RE AN HE AU NG SE IT DI IC SC LE DA NS IS ME RA AL TU RT EL HT UE OR ZE WE LI NT RU VE SS EG".split(
    " ",
  ),
);

export function germanScore(text: string): number {
  let score = 0;
  for (const word of WORDS) {
    let at = text.indexOf(word);
    while (at >= 0) {
      score += (word.length - 2) * 3;
      at = text.indexOf(word, at + 1);
    }
  }
  for (let i = 0; i + 1 < text.length; i++) if (BIGRAMS.has(text.slice(i, i + 2))) score += 1;
  return score;
}

export interface RecoveredKey {
  config: MachineConfig;
  plaintext: string;
  score: number;
  /** Rings whose value changed the decrypt; the others are unobservable. */
  determinedRings: Triple<boolean>;
  addedPairs: string[];
}

/**
 * From a Bombe stop (wheel order, core offsets at the crib, partial steckers)
 * reconstruct a full working key: try the right and middle ring settings (they
 * decide where turnovers fall), then finish the plugboard by hill-climbing the
 * German score with pairs among the letters the menu never reached.
 */
export function recoverKey(
  ciphertext: string,
  cribOffset: number,
  rotors: Triple<RotorId>,
  reflector: ReflectorId,
  core: Triple<number>,
  steckers: Map<number, number>,
): RecoveredKey {
  const base = steckerText(steckers);
  const tryRings = (plug: Uint8Array) => {
    let best: { config: MachineConfig; text: string; score: number } | null = null;
    const scores = new Map<string, number>();
    for (let rm = 0; rm < 26; rm++)
      for (let rr = 0; rr < 26; rr++) {
        const rings: Triple<number> = [0, rm, rr];
        // Start windows such that after cribOffset+1 key presses the cores
        // equal the stop; try the possible numbers of middle/left steps.
        for (let dm = 0; dm <= 2; dm++)
          for (let dl = 0; dl <= 1; dl++) {
            const start: Triple<number> = [
              mod26(core[0] - dl),
              mod26(core[1] + rm - dm),
              mod26(core[2] + rr - cribOffset - 1),
            ];
            const config: MachineConfig = {
              rotors: [...rotors] as Triple<RotorId>,
              reflector,
              positions: start,
              rings,
              plugboard: "",
            };
            if (!reachesCore(config, cribOffset, core)) continue;
            const text = fastEnigma(config, ciphertext, plug);
            const score = germanScore(text);
            scores.set(`${rm},${rr}`, Math.max(scores.get(`${rm},${rr}`) ?? -1, score));
            if (!best || score > best.score) best = { config, text, score };
          }
      }
    return { best: best!, scores };
  };

  const plug = plugMap(base);
  let { best, scores } = tryRings(plug);
  // Hill-climb leftover pairs among letters that no stecker value touched.
  const touched = new Set<number>();
  for (const [a, b] of steckers) {
    touched.add(a);
    touched.add(b);
  }
  const free = [...ALPHABET].map((_, i) => i).filter((i) => !touched.has(i));
  const added: string[] = [];
  let current = plug;
  for (let round = 0; round < 6; round++) {
    let improved: { plug: Uint8Array; score: number; pair: string } | null = null;
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i],
          b = free[j];
        if (current[a] !== a || current[b] !== b) continue;
        const candidate = current.slice();
        candidate[a] = b;
        candidate[b] = a;
        const score = germanScore(fastEnigma(best.config, ciphertext, candidate));
        if (score > (improved?.score ?? best.score))
          improved = { plug: candidate, score, pair: ALPHABET[a] + ALPHABET[b] };
      }
    if (!improved) break;
    current = improved.plug;
    added.push(improved.pair);
    best = { ...best, text: fastEnigma(best.config, ciphertext, current), score: improved.score };
  }
  if (added.length) ({ best, scores } = tryRings(current));

  const plugboard = [base, ...added].filter(Boolean).join(" ").trim();
  const top = best.score;
  const bestRings = best.config.rings;
  // A ring is "determined" when changing it alone lowers the score.
  const rightMatters = [...scores].some(
    ([key, score]) => key.startsWith(`${bestRings[1]},`) && key !== `${bestRings[1]},${bestRings[2]}` && score < top,
  );
  const middleMatters = [...scores].some(
    ([key, score]) => key.endsWith(`,${bestRings[2]}`) && key !== `${bestRings[1]},${bestRings[2]}` && score < top,
  );
  return {
    config: { ...best.config, plugboard: normalisePairs(plugboard) },
    plaintext: fastEnigma({ ...best.config, plugboard: normalisePairs(plugboard) }, ciphertext),
    score: top,
    determinedRings: [false, middleMatters, rightMatters],
    addedPairs: added,
  };
}

function normalisePairs(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => [...p].sort().join(""))
    .sort()
    .join(" ");
}

/** Does `config` reach the given cores when the crib's first letter is typed? */
function reachesCore(config: MachineConfig, cribOffset: number, core: Triple<number>) {
  const M = ROTORS[config.rotors[1]],
    R = ROTORS[config.rotors[2]];
  let [pl, pm, pr] = config.positions;
  for (let k = 0; k <= cribOffset; k++) {
    const mid = M.notches.includes(pm),
      right = R.notches.includes(pr);
    if (mid) pl = mod26(pl + 1);
    if (mid || right) pm = mod26(pm + 1);
    pr = mod26(pr + 1);
  }
  return (
    mod26(pl - config.rings[0]) === core[0] &&
    mod26(pm - config.rings[1]) === core[1] &&
    mod26(pr - config.rings[2]) === core[2]
  );
}

/** True when the middle rotor (and so the Bombe model) is disturbed in the crib. */
export function turnoverInside(config: MachineConfig, cribOffset: number, length: number) {
  const M = ROTORS[config.rotors[1]],
    R = ROTORS[config.rotors[2]];
  let [pl, pm, pr] = config.positions;
  let disturbed = false;
  for (let k = 0; k < cribOffset + length; k++) {
    const mid = M.notches.includes(pm),
      right = R.notches.includes(pr);
    if (k > cribOffset && (mid || right)) disturbed = true;
    if (mid) pl = mod26(pl + 1);
    if (mid || right) pm = mod26(pm + 1);
    pr = mod26(pr + 1);
  }
  void pl;
  return disturbed;
}

export const mask26 = (mask: number) =>
  [...ALPHABET].filter((_, i) => mask & (1 << i)).join("");
