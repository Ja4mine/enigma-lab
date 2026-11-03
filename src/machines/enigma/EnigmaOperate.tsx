import { useState } from "react";
import {
  ALPHABET,
  REFLECTORS,
  ROTORS,
  validateConfig,
  type KeyResult,
  type MachineConfig,
  type RotorId,
} from "../../core/enigma";
import { useLang } from "../../i18n";
import { ROWS } from "./model";
import { SignalLadder } from "./SignalLadder";

const ROTOR_IDS = Object.keys(ROTORS) as RotorId[];
const two = (n: number) => String(n + 1).padStart(2, "0");
const groups = (s: string) => s.match(/.{1,5}/g)?.join(" ") ?? "";

export function KeySummary({ initial, current }: { initial: MachineConfig; current: MachineConfig }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  return (
    <div className="key-strip">
      <span>
        {zh ? "转子" : "Wheels"} <b>{initial.rotors.join(" ")}</b>
      </span>
      <span>
        UKW <b>{initial.reflector}</b>
      </span>
      <span>
        {zh ? "环" : "Rings"} <b>{initial.rings.map(two).join(" ")}</b>
      </span>
      <span>
        {zh ? "起始" : "Start"} <b>{initial.positions.map((p) => ALPHABET[p]).join("")}</b>
      </span>
      <span>
        {zh ? "插线" : "Plugs"} <b>{initial.plugboard || "—"}</b>
      </span>
      <span>
        {zh ? "当前窗口" : "Windows now"} <b>{current.positions.map(two).join(" ")}</b>
      </span>
    </div>
  );
}

export function SettingsForm({
  initial,
  onApply,
  onCancel,
}: {
  initial: MachineConfig;
  onApply: (config: MachineConfig) => void;
  onCancel: () => void;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [draft, setDraft] = useState<MachineConfig>(() => ({
    ...initial,
    rotors: [...initial.rotors],
    rings: [...initial.rings],
    positions: [...initial.positions],
  }));
  const [error, setError] = useState("");
  const setRotor = (slot: number, id: RotorId) => {
    const rotors = [...draft.rotors] as MachineConfig["rotors"];
    const other = rotors.indexOf(id);
    if (other >= 0 && other !== slot) rotors[other] = rotors[slot];
    rotors[slot] = id;
    setDraft({ ...draft, rotors });
  };
  const setNum = (key: "rings" | "positions", slot: number, value: number) => {
    const next = [...draft[key]] as MachineConfig["rings"];
    next[slot] = value;
    setDraft({ ...draft, [key]: next });
  };
  const apply = () => {
    const config = { ...draft, plugboard: draft.plugboard.trim().toUpperCase().replace(/\s+/g, " ") };
    try {
      validateConfig(config);
    } catch (e) {
      const msg = (e as Error).message;
      setError(zh ? msg : translateError(msg));
      return;
    }
    setError("");
    onApply(config);
  };
  return (
    <div>
      <div className="rotor-grid" role="group" aria-label={zh ? "转子设置" : "Rotor settings"}>
        <span />
        {(zh ? ["左", "中", "右"] : ["Left", "Middle", "Right"]).map((h) => (
          <span key={h} className="head">
            {h}
          </span>
        ))}
        <span className="row-label">{zh ? "转子" : "Wheel"}</span>
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            value={draft.rotors[i]}
            aria-label={`${zh ? "转子" : "Wheel"} ${i + 1}`}
            onChange={(e) => setRotor(i, e.target.value as RotorId)}
          >
            {ROTOR_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        ))}
        <span className="row-label">{zh ? "环设置" : "Ring"}</span>
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            value={draft.rings[i]}
            aria-label={`${zh ? "环设置" : "Ring"} ${i + 1}`}
            onChange={(e) => setNum("rings", i, Number(e.target.value))}
          >
            {[...ALPHABET].map((ch, n) => (
              <option key={ch} value={n}>
                {two(n)} · {ch}
              </option>
            ))}
          </select>
        ))}
        <span className="row-label">{zh ? "起始位置" : "Start"}</span>
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            value={draft.positions[i]}
            aria-label={`${zh ? "起始位置" : "Start"} ${i + 1}`}
            onChange={(e) => setNum("positions", i, Number(e.target.value))}
          >
            {[...ALPHABET].map((ch, n) => (
              <option key={ch} value={n}>
                {ch} · {two(n)}
              </option>
            ))}
          </select>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, marginTop: 10, alignItems: "end" }}>
        <label className="field">
          {zh ? "反射器" : "Reflector"}
          <select value={draft.reflector} onChange={(e) => setDraft({ ...draft, reflector: e.target.value as "B" | "C" })}>
            {Object.keys(REFLECTORS).map((id) => (
              <option key={id} value={id}>
                UKW-{id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {zh ? "插线（空格分隔，最多 10 对）" : "Plugs (space-separated, up to 10)"}
          <input
            className="mono"
            value={draft.plugboard}
            placeholder="AT BX CM"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setDraft({ ...draft, plugboard: e.target.value.toUpperCase() })}
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={apply}>
          {zh ? "应用并复位" : "Apply and reset"}
        </button>
        <button type="button" className="btn quiet" onClick={onCancel}>
          {zh ? "取消" : "Cancel"}
        </button>
      </div>
      <p className="note">
        {zh
          ? "应用会把窗口拨回起始位置，并清空本次电文记录。"
          : "Applying turns the windows back to the start position and clears the message log."}
      </p>
    </div>
  );
}

function translateError(msg: string) {
  if (msg.includes("10 组")) return "At most 10 plug cables in wartime use.";
  if (msg.includes("格式无效")) return "Plugs must be letter pairs such as AB CD.";
  if (msg.includes("自身")) return "A plug cannot connect a letter to itself.";
  if (msg.includes("重复")) return "A letter can only be used by one cable.";
  if (msg.includes("同一个实体转子")) return "One physical rotor cannot sit in two slots.";
  return msg;
}

export function Keyboard({ onKey, down }: { onKey: (ch: string) => void; down: string | null }) {
  const { lang } = useLang();
  return (
    <div className="kbd" role="group" aria-label={lang === "zh" ? "键盘" : "Keyboard"}>
      {ROWS.map((row) => (
        <div key={row} className="kbd-row">
          {[...row].map((ch) => (
            <button key={ch} type="button" className={down === ch ? "down" : ""} onClick={() => onKey(ch)}>
              {ch}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Lamps({ lit }: { lit: string | null }) {
  const { lang } = useLang();
  return (
    <div className="kbd lamps" aria-label={lang === "zh" ? "灯板" : "Lampboard"} aria-live="polite">
      {ROWS.map((row) => (
        <div key={row} className="kbd-row">
          {[...row].map((ch) => (
            <span key={ch} className={lit === ch ? "lit" : ""}>
              {ch}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function StageList({ trace }: { trace: KeyResult }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const name: Record<string, string> = zh
    ? {
        "plug-in": "插线板（进）",
        "right-forward": "右转子 →",
        "middle-forward": "中转子 →",
        "left-forward": "左转子 →",
        reflector: "反射器",
        "left-reverse": "左转子 ←",
        "middle-reverse": "中转子 ←",
        "right-reverse": "右转子 ←",
        "plug-out": "插线板（出）",
      }
    : {
        "plug-in": "Plugboard in",
        "right-forward": "Right rotor →",
        "middle-forward": "Middle rotor →",
        "left-forward": "Left rotor →",
        reflector: "Reflector",
        "left-reverse": "Left rotor ←",
        "middle-reverse": "Middle rotor ←",
        "right-reverse": "Right rotor ←",
        "plug-out": "Plugboard out",
      };
  return (
    <ol className="stage-list">
      {trace.stages.map((s) => (
        <li key={s.id}>
          <span>
            <span className={`swatch ${["left-reverse", "middle-reverse", "right-reverse", "plug-out"].includes(s.id) ? "back" : "fwd"}`} />
            {name[s.id]}
            {s.rotorId && (
              <span style={{ color: "var(--ink-3)" }}>
                {" "}
                {s.rotorId} · k={(s.position! - s.ring! + 26) % 26}
              </span>
            )}
          </span>
          <b>
            {ALPHABET[s.input]} → {ALPHABET[s.output]}
          </b>
        </li>
      ))}
    </ol>
  );
}

export function SteppingNote({ trace }: { trace: KeyResult }) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const moved = trace.stepped
    .map((s, i) => (s ? (zh ? ["左", "中", "右"][i] : ["left", "middle", "right"][i]) : null))
    .filter(Boolean)
    .join(zh ? "、" : ", ");
  const before = trace.before.map(two).join(" "),
    after = trace.after.map(two).join(" ");
  return (
    <p className="note">
      {zh ? `步进：${moved}转子前进（窗口 ${before} → ${after}）` : `Stepping: ${moved} rotor${trace.stepped.filter(Boolean).length > 1 ? "s" : ""} advanced (windows ${before} → ${after})`}
      {trace.doubleStep && (zh ? "。中转子在自己的缺口处双步进。" : ". The middle rotor double-stepped at its own notch.")}
    </p>
  );
}

export function OperatePanel({
  initial,
  current,
  trace,
  history,
  signal,
  onKey,
  onApply,
  onReset,
  onMessage,
  down,
}: {
  initial: MachineConfig;
  current: MachineConfig;
  trace: KeyResult | null;
  history: KeyResult[];
  signal: number;
  onKey: (ch: string) => void;
  onApply: (config: MachineConfig) => void;
  onReset: () => void;
  onMessage: (text: string) => string | null;
  down: string | null;
}) {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("HELLOWORLD");
  const [msgError, setMsgError] = useState("");
  const plain = history.map((h) => h.input).join("");
  const cipher = history.map((h) => h.output).join("");
  return (
    <>
      <div className="section">
        <div className="section-head">
          <h3>{zh ? "机器设置" : "Machine key"}</h3>
          <button type="button" className="link" onClick={() => setEditing((v) => !v)}>
            {editing ? (zh ? "收起" : "Close") : zh ? "修改" : "Change"}
          </button>
        </div>
        {editing ? (
          <SettingsForm
            initial={initial}
            onApply={(c) => {
              onApply(c);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <KeySummary initial={initial} current={current} />
        )}
      </div>
      <div className="section">
        <div className="section-head">
          <h3>{zh ? "按一个键" : "Press a key"}</h3>
          <span className="aside">{zh ? "也可以直接用电脑键盘" : "Your keyboard works too"}</span>
        </div>
        <Keyboard onKey={onKey} down={down} />
        <div style={{ height: 10 }} />
        <Lamps lit={trace && signal >= 2 ? trace.output : null} />
        {trace && (
          <div className="io-line" aria-live="polite">
            <span className="big">{trace.input}</span>
            <span className="arrow">→</span>
            <span className="big out">{signal >= 2 ? trace.output : "·"}</span>
          </div>
        )}
        {trace && <SteppingNote trace={trace} />}
      </div>
      <div className="section">
        <div className="section-head">
          <h3>{zh ? "电流路径" : "Current path"}</h3>
          <span className="aside">
            <span className="swatch fwd" />
            {zh ? "去程" : "out"} <span className="swatch back" style={{ marginLeft: 8 }} />
            {zh ? "回程" : "back"}
          </span>
        </div>
        <SignalLadder trace={trace} progress={trace ? signal : 0} />
        {trace && <StageList trace={trace} />}
      </div>
      <div className="section">
        <div className="section-head">
          <h3>{zh ? "电文" : "Message"}</h3>
          <button type="button" className="link" onClick={onReset} disabled={!history.length}>
            {zh ? "复位到起始位置" : "Reset to start"}
          </button>
        </div>
        <textarea
          className="textbox"
          rows={2}
          value={text}
          spellCheck={false}
          aria-label={zh ? "要加密的文字" : "Text to encipher"}
          onChange={(e) => {
            setText(e.target.value.toUpperCase());
            setMsgError("");
          }}
        />
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const err = onMessage(text);
              setMsgError(err ?? "");
            }}
          >
            {zh ? "从当前位置加密" : "Encipher from here"}
          </button>
        </div>
        {msgError && <p className="error">{msgError}</p>}
        <p className="note" style={{ marginBottom: 6 }}>
          {zh ? "同一套起始设置下再输入密文，就会得到明文——这是反射器带来的互逆性。" : "Type the ciphertext again from the same start and the plaintext comes back: the reflector makes the machine its own inverse."}
        </p>
        <div className="tape" aria-label={zh ? "输入记录" : "Input log"}>
          {plain ? groups(plain) : <span className="dim">{zh ? "（还没有输入）" : "(nothing typed yet)"}</span>}
        </div>
        <div className="tape" style={{ marginTop: 6 }} aria-label={zh ? "输出记录" : "Output log"}>
          {cipher ? groups(cipher) : <span className="dim">—</span>}
        </div>
      </div>
    </>
  );
}
