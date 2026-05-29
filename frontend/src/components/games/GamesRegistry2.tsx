// 20 additional playable mini-games — each calls session.play() to award points.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";

type SessionApi = { play: (label?: string) => Promise<number | null>; submitting: boolean };
const buzz = (k: "light" | "med" | "heavy" = "light") => {
  try { Haptics.impactAsync(({ light: Haptics.ImpactFeedbackStyle.Light, med: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy } as any)[k]); } catch {}
};

// 12. Rock Paper Scissors
export function RockPaperGame({ session }: { session: SessionApi }) {
  const PICKS = ["rock", "paper", "scissors"] as const;
  const ICONS: any = { rock: "circle", paper: "square", scissors: "scissors" };
  const [you, setYou] = useState<typeof PICKS[number] | null>(null);
  const [cpu, setCpu] = useState<typeof PICKS[number] | null>(null);
  const [result, setResult] = useState<string>("");

  const choose = async (p: typeof PICKS[number]) => {
    if (you) return;
    buzz("med");
    const c = PICKS[Math.floor(Math.random() * 3)];
    setYou(p); setCpu(c);
    const beats: Record<string, string> = { rock: "scissors", paper: "rock", scissors: "paper" };
    const res = p === c ? "Draw!" : beats[p] === c ? "You win!" : "CPU wins";
    setResult(res);
    setTimeout(async () => {
      await session.play(res);
      setYou(null); setCpu(null); setResult("");
    }, 1200);
  };

  return (
    <View style={s.col}>
      <Text style={s.hint}>Beat the CPU at Rock-Paper-Scissors</Text>
      <View style={s.rpsRow}>
        <Slot label="You" pick={you} icon={you ? ICONS[you] : undefined} />
        <Text style={s.rpsVs}>VS</Text>
        <Slot label="CPU" pick={cpu} icon={cpu ? ICONS[cpu] : undefined} />
      </View>
      {result ? <Text style={s.bigResult}>{result}</Text> : null}
      <View style={s.row}>
        {PICKS.map((p) => (
          <Pressable key={p} disabled={!!you} testID={`rps-${p}`} style={[s.choiceBtn, !!you && { opacity: 0.4 }]} onPress={() => choose(p)}>
            <Feather name={ICONS[p]} size={32} color="#fff" />
            <Text style={s.choiceLbl}>{p.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Slot({ label, icon }: { label: string; pick: string | null; icon?: any }) {
  return (
    <View style={s.slot}>
      <Text style={s.slotLabel}>{label}</Text>
      <View style={s.slotIcon}>{icon ? <Feather name={icon} size={36} color={colors.primary} /> : <Text style={s.slotQ}>?</Text>}</View>
    </View>
  );
}

// 13. Coin Flip
export function CoinFlipGame({ session }: { session: SessionApi }) {
  const [choice, setChoice] = useState<"H" | "T" | null>(null);
  const [result, setResult] = useState<"H" | "T" | null>(null);
  const flip = useRef(new Animated.Value(0)).current;
  const choose = (c: "H" | "T") => {
    if (choice) return;
    buzz();
    setChoice(c);
    const r = Math.random() > 0.5 ? "H" : "T";
    Animated.timing(flip, { toValue: 1, duration: 1000, useNativeDriver: true }).start(async () => {
      setResult(r);
      await session.play(r === c ? "You won!" : "Try again");
      setChoice(null); setResult(null); flip.setValue(0);
    });
  };
  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1800deg"] });
  return (
    <View style={[s.col, { alignItems: "center" }]}>
      <Text style={s.hint}>Heads or Tails?</Text>
      <Animated.View style={[s.coin, { transform: [{ rotateY }] }]}>
        <Text style={s.coinFace}>{result || "?"}</Text>
      </Animated.View>
      <View style={s.row}>
        <Pressable testID="coin-H" disabled={!!choice} style={[s.bigBtn, { backgroundColor: "#F59E0B" }]} onPress={() => choose("H")}><Text style={s.bigBtnTxt}>HEADS</Text></Pressable>
        <Pressable testID="coin-T" disabled={!!choice} style={[s.bigBtn, { backgroundColor: "#3B82F6" }]} onPress={() => choose("T")}><Text style={s.bigBtnTxt}>TAILS</Text></Pressable>
      </View>
    </View>
  );
}

// 14. Dice Duel
export function DiceRollGame({ session }: { session: SessionApi }) {
  const [you, setYou] = useState<number | null>(null);
  const [cpu, setCpu] = useState<number | null>(null);
  const roll = async () => {
    buzz("med");
    const y = Math.floor(Math.random() * 6) + 1;
    const c = Math.floor(Math.random() * 6) + 1;
    setYou(y); setCpu(c);
    const res = y > c ? "You win!" : y < c ? "CPU wins" : "Draw!";
    setTimeout(async () => { await session.play(res); setYou(null); setCpu(null); }, 1200);
  };
  return (
    <View style={[s.col, { alignItems: "center" }]}>
      <Text style={s.hint}>Higher dice wins the round</Text>
      <View style={s.row}>
        <Die label="You" v={you} />
        <Die label="CPU" v={cpu} />
      </View>
      <Pressable testID="dice-roll" disabled={you !== null} style={[s.startBtn, you !== null && { opacity: 0.5 }]} onPress={roll}><Text style={s.startTxt}>ROLL</Text></Pressable>
    </View>
  );
}
function Die({ label, v }: { label: string; v: number | null }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={s.slotLabel}>{label}</Text>
      <View style={s.die}><Text style={s.dieNum}>{v ?? "?"}</Text></View>
    </View>
  );
}

// 15. Odd One Out
export function OddOneOutGame({ session }: { session: SessionApi }) {
  const COLORS_LIST = ["#EF4444", "#10B981", "#3B82F6", "#F59E0B", "#8B5CF6"];
  const gen = () => {
    const base = COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)];
    const odd = Math.floor(Math.random() * 9);
    return { base, odd, oddColor: COLORS_LIST.filter((c) => c !== base)[Math.floor(Math.random() * 4)] };
  };
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const TOTAL = 5;
  const tap = (i: number) => {
    buzz();
    const win = i === q.odd;
    setTimeout(async () => {
      const c = correct + (win ? 1 : 0);
      if (round >= TOTAL) {
        await session.play(`${c}/${TOTAL} correct`);
        setRound(1); setCorrect(0); setQ(gen());
      } else { setCorrect(c); setRound(round + 1); setQ(gen()); }
    }, 250);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Round {round}/{TOTAL} · Tap the odd one out</Text>
      <View style={s.oddGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Pressable key={i} testID={`odd-${i}`} style={[s.oddCell, { backgroundColor: i === q.odd ? q.oddColor : q.base }]} onPress={() => tap(i)} />
        ))}
      </View>
    </View>
  );
}

// 16. True or False (math)
export function TrueFalseGame({ session }: { session: SessionApi }) {
  const gen = () => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const ans = a + b;
    const shown = Math.random() > 0.5 ? ans : ans + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 5) + 1);
    return { a, b, shown, isTrue: shown === ans };
  };
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const TOTAL = 5;
  const choose = (val: boolean) => {
    buzz();
    const win = val === q.isTrue;
    setTimeout(async () => {
      const c = correct + (win ? 1 : 0);
      if (round >= TOTAL) {
        await session.play(`${c}/${TOTAL} correct`);
        setRound(1); setCorrect(0); setQ(gen());
      } else { setCorrect(c); setRound(round + 1); setQ(gen()); }
    }, 350);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Round {round}/{TOTAL} · Is this correct?</Text>
      <View style={s.tfCard}><Text style={s.tfText}>{q.a} + {q.b} = {q.shown}</Text></View>
      <View style={s.row}>
        <Pressable testID="tf-true" style={[s.bigBtn, { backgroundColor: colors.success }]} onPress={() => choose(true)}><Text style={s.bigBtnTxt}>TRUE</Text></Pressable>
        <Pressable testID="tf-false" style={[s.bigBtn, { backgroundColor: colors.error }]} onPress={() => choose(false)}><Text style={s.bigBtnTxt}>FALSE</Text></Pressable>
      </View>
    </View>
  );
}

// 17. Tap Storm (count taps in 10s)
export function TapCounterGame({ session }: { session: SessionApi }) {
  const [active, setActive] = useState(false);
  const [time, setTime] = useState(10);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (time <= 0) {
      setActive(false);
      (async () => { await session.play(`${count} taps`); setCount(0); })();
      return;
    }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, active, count, session]);
  return (
    <View style={[s.col, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
      {!active ? (
        <>
          <Text style={s.startTitle}>Tap as fast as you can for 10 seconds!</Text>
          <Pressable testID="tap-start" style={s.startBtn} onPress={() => { setActive(true); setTime(10); setCount(0); }}><Text style={s.startTxt}>Start</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={s.hint}>Time: {time}s · Taps: {count}</Text>
          <Pressable testID="tap-pad" style={s.tapPad} onPress={() => { buzz(); setCount(count + 1); }}>
            <Text style={s.tapCount}>{count}</Text>
            <Text style={s.tapHint}>TAP!</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// 18. Reaction Test
export function ReactionGame({ session }: { session: SessionApi }) {
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "done">("idle");
  const [ms, setMs] = useState<number | null>(null);
  const startRef = useRef(0);
  const timerRef = useRef<any>(null);

  const start = () => {
    setPhase("wait"); setMs(null);
    const wait = 1000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => { startRef.current = Date.now(); setPhase("go"); }, wait);
  };
  const tap = async () => {
    if (phase === "wait") {
      clearTimeout(timerRef.current); setPhase("idle");
      return;
    }
    if (phase === "go") {
      buzz("med");
      const reaction = Date.now() - startRef.current;
      setMs(reaction); setPhase("done");
      await session.play(`${reaction}ms`);
      setTimeout(() => setPhase("idle"), 1500);
    }
  };

  const bg = phase === "go" ? colors.success : phase === "wait" ? colors.error : phase === "done" ? colors.secondary : colors.primary;
  const label = phase === "idle" ? "TAP TO START" : phase === "wait" ? "WAIT..." : phase === "go" ? "TAP NOW!" : `${ms} ms`;

  return (
    <View style={[s.col, { flex: 1 }]}>
      <Text style={s.hint}>Wait for green, then tap as fast as possible</Text>
      <Pressable testID="reaction-pad" style={[s.reactionPad, { backgroundColor: bg }]} onPress={phase === "idle" ? start : tap}>
        <Text style={s.reactionTxt}>{label}</Text>
      </Pressable>
    </View>
  );
}

// 19. Simon Says
export function SimonSaysGame({ session }: { session: SessionApi }) {
  const COLS = ["#EF4444", "#10B981", "#3B82F6", "#F59E0B"];
  const [seq, setSeq] = useState<number[]>([]);
  const [input, setInput] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);

  const next = useCallback(() => {
    const ns = [...seq, Math.floor(Math.random() * 4)]; setSeq(ns); setInput([]);
    setShowing(true);
    ns.forEach((idx, i) => {
      setTimeout(() => { setActive(idx); buzz(); setTimeout(() => setActive(null), 300); }, (i + 1) * 700);
    });
    setTimeout(() => setShowing(false), ns.length * 700 + 400);
  }, [seq]);

  useEffect(() => { if (seq.length === 0) next(); }, []); // eslint-disable-line

  const tap = async (i: number) => {
    if (showing) return;
    setActive(i); setTimeout(() => setActive(null), 200);
    const ni = [...input, i];
    if (seq[ni.length - 1] !== i) {
      await session.play(`Reached round ${seq.length}`);
      setSeq([]); setInput([]);
      setTimeout(() => next(), 800);
      return;
    }
    setInput(ni);
    if (ni.length === seq.length) setTimeout(() => next(), 600);
  };

  return (
    <View style={s.col}>
      <Text style={s.hint}>Round {seq.length} · {showing ? "Watch the pattern..." : "Repeat the pattern"}</Text>
      <View style={s.simonGrid}>
        {COLS.map((c, i) => (
          <Pressable key={i} testID={`simon-${i}`} disabled={showing} style={[s.simonCell, { backgroundColor: c, opacity: active === i ? 1 : 0.45 }]} onPress={() => tap(i)} />
        ))}
      </View>
    </View>
  );
}

// 20. Whack-a-Mole
export function WhackMoleGame({ session }: { session: SessionApi }) {
  const [target, setTarget] = useState(-1);
  const [active, setActive] = useState(false);
  const [time, setTime] = useState(15);
  const [hits, setHits] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (time <= 0) {
      setActive(false); setTarget(-1);
      (async () => { await session.play(`${hits} moles`); setHits(0); })();
      return;
    }
    const t = setTimeout(() => setTime(time - 1), 1000);
    const m = setInterval(() => setTarget(Math.floor(Math.random() * 9)), 700);
    return () => { clearTimeout(t); clearInterval(m); };
  }, [time, active, hits, session]);

  const tap = (i: number) => {
    if (!active) return;
    if (i === target) { buzz("med"); setHits(hits + 1); setTarget(-1); } else buzz();
  };

  if (!active) {
    return (
      <View style={[s.col, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={s.startTitle}>Whack the moles — 15 seconds!</Text>
        <Pressable testID="whack-start" style={s.startBtn} onPress={() => { setActive(true); setTime(15); setHits(0); }}><Text style={s.startTxt}>Start</Text></Pressable>
      </View>
    );
  }
  return (
    <View style={s.col}>
      <View style={s.metaRow}><Text style={s.hint}>Time: {time}s</Text><Text style={s.hint}>Hits: {hits}</Text></View>
      <View style={s.moleGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Pressable key={i} testID={`mole-${i}`} style={[s.moleHole, i === target && s.moleUp]} onPress={() => tap(i)}>
            {i === target ? <Text style={s.moleEmoji}>🦔</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// 21. Merge 2048 (simplified — pick higher number wins)
export function MergeGame({ session }: { session: SessionApi }) {
  const [tiles, setTiles] = useState<number[]>(() => [2, 2, 4]);
  const [merged, setMerged] = useState<number | null>(null);
  const tap = (i: number) => {
    if (merged !== null || tiles.length < 2) return;
    buzz();
    const next = [...tiles];
    const v = next[i];
    if (next[i + 1] === v || next[i - 1] === v) {
      const partner = next[i + 1] === v ? i + 1 : i - 1;
      const merge = v * 2; const lo = Math.min(i, partner);
      next.splice(Math.min(i, partner), 2, merge); setTiles(next); setMerged(merge);
      setTimeout(async () => {
        if (merge >= 32) { await session.play(`Reached ${merge}!`); setTiles([2, 2, 4]); }
        else { setTiles([...next, [2, 4, 8][Math.floor(Math.random() * 3)]]); }
        setMerged(null);
      }, 600);
    }
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Tap two adjacent equal tiles to merge. Reach 32!</Text>
      <View style={s.mergeRow}>
        {tiles.map((t, i) => (
          <Pressable key={i} testID={`merge-${i}`} style={[s.mergeTile, { backgroundColor: tileColor(t) }, merged === t && { transform: [{ scale: 1.15 }] }]} onPress={() => tap(i)}>
            <Text style={s.mergeNum}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function tileColor(n: number) {
  const map: Record<number, string> = { 2: "#FDE68A", 4: "#FCD34D", 8: "#FBBF24", 16: "#F59E0B", 32: "#EA580C", 64: "#DC2626" };
  return map[n] || "#7C2D12";
}

// 22. Connect Dots (tap 1→N in order — fewer dots than Number Rush)
export function ConnectDotsGame({ session }: { session: SessionApi }) {
  const buildDots = () => Array.from({ length: 6 }, (_, i) => i + 1).sort(() => Math.random() - 0.5).map((n) => ({ n, x: Math.random() * 80 + 10, y: Math.random() * 60 + 10 }));
  const [dots, setDots] = useState(buildDots);
  const [next, setNext] = useState(1);
  const tap = async (n: number) => {
    if (n !== next) { buzz(); return; }
    buzz("med");
    if (n === 6) { await session.play("All connected!"); setDots(buildDots()); setNext(1); }
    else setNext(next + 1);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Tap 1→6 in order · Next: {next}</Text>
      <View style={s.connectBoard}>
        {dots.map((d) => (
          <Pressable
            key={d.n}
            testID={`dot-${d.n}`}
            style={[s.dot, { left: `${d.x}%`, top: `${d.y}%`, backgroundColor: d.n < next ? colors.success : d.n === next ? colors.primary : colors.surfaceVariant }]}
            onPress={() => tap(d.n)}
          >
            <Text style={[s.dotN, { color: d.n <= next ? "#fff" : colors.textSecondary }]}>{d.n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// 23. Color Sort (tap items into correct bin)
export function ColorSortGame({ session }: { session: SessionApi }) {
  const COL_OPTS = ["#EF4444", "#10B981", "#3B82F6"];
  const gen = () => Array.from({ length: 6 }, () => COL_OPTS[Math.floor(Math.random() * 3)]);
  const [items, setItems] = useState(gen);
  const [target, setTarget] = useState(COL_OPTS[0]);
  const [score, setScore] = useState(0);
  const tap = (i: number) => {
    buzz();
    const win = items[i] === target;
    if (!win) return;
    const next = items.filter((_, idx) => idx !== i);
    if (next.length === 0) {
      (async () => { await session.play(`Sorted ${score + 1}!`); setItems(gen()); setScore(0); setTarget(COL_OPTS[0]); })();
    } else {
      setItems(next); setScore(score + 1);
      const colorsLeft = Array.from(new Set(next));
      setTarget(colorsLeft[Math.floor(Math.random() * colorsLeft.length)]);
    }
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Tap items matching the target color</Text>
      <View style={[s.targetBin, { backgroundColor: target }]}><Text style={s.targetTxt}>TARGET</Text></View>
      <View style={s.row}>
        {items.map((c, i) => (
          <Pressable key={i} testID={`sort-${i}`} style={[s.sortItem, { backgroundColor: c }]} onPress={() => tap(i)} />
        ))}
      </View>
    </View>
  );
}

// 24. Spell It (pick letters to spell word from grid)
export function SpellBeeGame({ session }: { session: SessionApi }) {
  const WORDS = ["CASH", "GAME", "WIN", "PLAY", "PRIZE", "GOAL"];
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const [word, setWord] = useState(pick);
  const [letters, setLetters] = useState<string[]>([]);
  const [grid, setGrid] = useState<string[]>([]);
  useEffect(() => {
    const extras = Array.from({ length: 9 - word.length }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]);
    setGrid([...word.split(""), ...extras].sort(() => Math.random() - 0.5));
    setLetters([]);
  }, [word]);
  const pickLetter = (i: number) => {
    if (letters.includes(grid[i])) return;
    buzz();
    const target = word[letters.length];
    if (grid[i] !== target) return;
    const nl = [...letters, grid[i]]; setLetters(nl);
    if (nl.length === word.length) (async () => { await session.play(`${word} spelled!`); setWord(pick()); })();
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Spell: <Text style={{ fontFamily: fonts.heading }}>{word}</Text></Text>
      <View style={s.spellOut}>{word.split("").map((ch, i) => <View key={i} style={s.spellSlot}><Text style={s.spellSlotTxt}>{letters[i] || "_"}</Text></View>)}</View>
      <View style={s.spellGrid}>
        {grid.map((c, i) => (
          <Pressable key={i} testID={`spell-${i}`} style={[s.spellTile, letters.includes(c) && { opacity: 0.3 }]} onPress={() => pickLetter(i)}><Text style={s.spellTileTxt}>{c}</Text></Pressable>
        ))}
      </View>
    </View>
  );
}

// 25. Trivia Pop
export function TriviaGame({ session }: { session: SessionApi }) {
  const QUESTIONS = [
    { q: "Capital of India?", opts: ["Mumbai", "Delhi", "Chennai", "Kolkata"], a: 1 },
    { q: "Largest ocean?", opts: ["Atlantic", "Indian", "Pacific", "Arctic"], a: 2 },
    { q: "Sun rises in?", opts: ["West", "East", "North", "South"], a: 1 },
    { q: "Square of 9?", opts: ["81", "72", "99", "18"], a: 0 },
    { q: "First president of USA?", opts: ["Lincoln", "Jefferson", "Washington", "Adams"], a: 2 },
    { q: "INR symbol?", opts: ["$", "€", "₹", "£"], a: 2 },
  ];
  const [q, setQ] = useState(() => QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const TOTAL = 3;
  const choose = (i: number) => {
    if (picked !== null) return;
    buzz();
    setPicked(i);
    setTimeout(async () => {
      const c = correct + (i === q.a ? 1 : 0);
      if (round >= TOTAL) {
        await session.play(`${c}/${TOTAL} correct`);
        setRound(1); setCorrect(0); setQ(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]); setPicked(null);
      } else { setCorrect(c); setRound(round + 1); setQ(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]); setPicked(null); }
    }, 700);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Question {round}/{TOTAL}</Text>
      <View style={s.tfCard}><Text style={s.tfText}>{q.q}</Text></View>
      <View style={s.opts}>
        {q.opts.map((o, i) => (
          <Pressable
            key={i}
            disabled={picked !== null}
            testID={`trivia-${i}`}
            style={[s.optBtn,
              picked === i && i === q.a && { backgroundColor: colors.success, borderColor: colors.success },
              picked === i && i !== q.a && { backgroundColor: colors.error, borderColor: colors.error },
              picked !== null && picked !== i && i === q.a && { borderColor: colors.success, backgroundColor: colors.primaryLight },
            ]}
            onPress={() => choose(i)}
          >
            <Text style={[s.optTxt, picked === i && { color: "#fff" }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// 26. Find the Pair (4 tiles, find matching emoji)
export function FindPairGame({ session }: { session: SessionApi }) {
  const POOL = ["🍎", "🍊", "🍋", "🍇", "🥑", "🌶️"];
  const gen = () => {
    const m = POOL[Math.floor(Math.random() * POOL.length)];
    const arr = [m, m, ...POOL.filter((x) => x !== m).slice(0, 4)].slice(0, 6).sort(() => Math.random() - 0.5);
    return { arr, match: m };
  };
  const [q, setQ] = useState(gen);
  const [picks, setPicks] = useState<number[]>([]);
  const tap = (i: number) => {
    if (picks.length >= 2 || picks.includes(i)) return;
    buzz();
    const np = [...picks, i]; setPicks(np);
    if (np.length === 2) {
      const win = q.arr[np[0]] === q.arr[np[1]] && q.arr[np[0]] === q.match;
      setTimeout(async () => {
        await session.play(win ? "Pair found!" : "Wrong pair");
        setQ(gen()); setPicks([]);
      }, 700);
    }
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Find the matching pair of: {q.match}</Text>
      <View style={s.pairGrid}>
        {q.arr.map((e, i) => (
          <Pressable key={i} testID={`pair-${i}`} style={[s.pairCell, picks.includes(i) && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => tap(i)}>
            <Text style={s.pairTxt}>{picks.includes(i) ? e : "❓"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// 27. Bubble Pop (tap bubbles before they vanish)
export function BubblePopGame({ session }: { session: SessionApi }) {
  const [bubbles, setBubbles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(15);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!active) return;
    if (time <= 0) { setActive(false); (async () => { await session.play(`Popped ${score}`); setScore(0); setBubbles([]); })(); return; }
    const t = setTimeout(() => setTime(time - 1), 1000);
    const sp = setInterval(() => {
      setBubbles((b) => [...b.slice(-4), { id: Date.now() + Math.random(), x: Math.random() * 80 + 5, y: Math.random() * 70 + 5 }]);
    }, 600);
    return () => { clearTimeout(t); clearInterval(sp); };
  }, [time, active, score, session]);
  const pop = (id: number) => { buzz("med"); setBubbles((b) => b.filter((x) => x.id !== id)); setScore(score + 1); };
  if (!active) {
    return (
      <View style={[s.col, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={s.startTitle}>Pop bubbles for 15 seconds!</Text>
        <Pressable testID="bubble-start" style={s.startBtn} onPress={() => { setActive(true); setTime(15); setScore(0); }}><Text style={s.startTxt}>Start</Text></Pressable>
      </View>
    );
  }
  return (
    <View style={s.col}>
      <View style={s.metaRow}><Text style={s.hint}>Time: {time}s</Text><Text style={s.hint}>Pops: {score}</Text></View>
      <View style={s.bubbleBoard}>
        {bubbles.map((b) => (
          <Pressable key={b.id} testID={`bubble-${b.id}`} style={[s.bubble, { left: `${b.x}%`, top: `${b.y}%` }]} onPress={() => pop(b.id)} />
        ))}
      </View>
    </View>
  );
}

// 28. Sequence Recall (memorize digit sequence)
export function SequenceRecallGame({ session }: { session: SessionApi }) {
  const [seq, setSeq] = useState<number[]>([]);
  const [show, setShow] = useState(false);
  const [input, setInput] = useState<number[]>([]);
  const start = () => {
    const len = Math.min(3 + Math.floor(Math.random() * 3), 6);
    const ns = Array.from({ length: len }, () => Math.floor(Math.random() * 10));
    setSeq(ns); setInput([]); setShow(true);
    setTimeout(() => setShow(false), 1200 + len * 400);
  };
  useEffect(() => { start(); }, []);
  const tap = async (n: number) => {
    if (show) return;
    buzz();
    const ni = [...input, n]; setInput(ni);
    if (ni.length === seq.length) {
      const win = ni.every((v, i) => v === seq[i]);
      await session.play(win ? "Sequence remembered!" : "Try again");
      setTimeout(() => start(), 500);
    }
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>{show ? "Memorize..." : "Tap the sequence"}</Text>
      <View style={s.seqShow}><Text style={s.seqTxt}>{show ? seq.join(" ") : input.join(" ") || "?"}</Text></View>
      <View style={s.seqGrid}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Pressable key={i} testID={`seq-${i}`} disabled={show} style={s.seqBtn} onPress={() => tap(i)}><Text style={s.seqBtnTxt}>{i}</Text></Pressable>
        ))}
      </View>
    </View>
  );
}

// 29. Lucky Dice (bet on a number 1-6)
export function LuckyDiceGame({ session }: { session: SessionApi }) {
  const [bet, setBet] = useState<number | null>(null);
  const [roll, setRoll] = useState<number | null>(null);
  const rollIt = async () => {
    if (bet === null) return;
    buzz("med");
    const r = Math.floor(Math.random() * 6) + 1; setRoll(r);
    setTimeout(async () => { await session.play(r === bet ? `Jackpot! Rolled ${r}` : `Rolled ${r}`); setBet(null); setRoll(null); }, 1100);
  };
  return (
    <View style={[s.col, { alignItems: "center" }]}>
      <Text style={s.hint}>Bet on a number — match the roll!</Text>
      <View style={s.row}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Pressable key={n} testID={`luckydice-${n}`} disabled={bet !== null} style={[s.luckyDice, bet === n && s.luckyDiceSel]} onPress={() => setBet(n)}>
            <Text style={s.luckyDiceTxt}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.die}><Text style={s.dieNum}>{roll ?? "?"}</Text></View>
      <Pressable testID="lucky-dice-roll" disabled={bet === null || roll !== null} style={[s.startBtn, (bet === null || roll !== null) && { opacity: 0.4 }]} onPress={rollIt}><Text style={s.startTxt}>ROLL</Text></Pressable>
    </View>
  );
}

// 30. Shape Match (which shape matches?)
export function ShapeMatchGame({ session }: { session: SessionApi }) {
  const SHAPES = ["circle", "square", "triangle", "hexagon"] as const;
  const gen = () => {
    const t = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return { target: t, opts: [...SHAPES].sort(() => Math.random() - 0.5) };
  };
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const TOTAL = 5;
  const choose = (sh: string) => {
    buzz();
    const win = sh === q.target;
    setTimeout(async () => {
      const c = correct + (win ? 1 : 0);
      if (round >= TOTAL) { await session.play(`${c}/${TOTAL}`); setRound(1); setCorrect(0); setQ(gen()); }
      else { setCorrect(c); setRound(round + 1); setQ(gen()); }
    }, 300);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Round {round}/{TOTAL} · Tap the {q.target}</Text>
      <View style={s.shapeRow}>
        {q.opts.map((sh) => (
          <Pressable key={sh} testID={`shape-${sh}`} style={s.shapeBox} onPress={() => choose(sh)}>
            <Shape kind={sh} />
            <Text style={s.shapeLbl}>{sh}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Shape({ kind }: { kind: string }) {
  if (kind === "circle") return <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary }} />;
  if (kind === "square") return <View style={{ width: 50, height: 50, backgroundColor: colors.error }} />;
  if (kind === "triangle") return <View style={{ width: 0, height: 0, borderLeftWidth: 25, borderRightWidth: 25, borderBottomWidth: 50, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: colors.secondary }} />;
  return <View style={{ width: 50, height: 50, backgroundColor: "#8B5CF6", transform: [{ rotate: "30deg" }] }} />;
}

// 31. Guess the Emoji
export function GuessEmojiGame({ session }: { session: SessionApi }) {
  const PUZZLES = [
    { e: "🌧️ + ☂️", opts: ["Rain", "Storm", "Sunshine", "Snow"], a: 0 },
    { e: "🐶 + 🏠", opts: ["Pet", "Doghouse", "Vet", "Park"], a: 1 },
    { e: "🎂 + 🎉", opts: ["Birthday", "Wedding", "Party", "Anniversary"], a: 0 },
    { e: "🌙 + ⭐", opts: ["Night", "Space", "Galaxy", "Sky"], a: 0 },
    { e: "🔥 + 💧", opts: ["Yin Yang", "Elements", "Battle", "Steam"], a: 3 },
    { e: "💰 + 📱", opts: ["Online Banking", "Wallet App", "CashClick", "Phone Bill"], a: 2 },
  ];
  const [q, setQ] = useState(() => PUZZLES[Math.floor(Math.random() * PUZZLES.length)]);
  const [picked, setPicked] = useState<number | null>(null);
  const choose = (i: number) => {
    if (picked !== null) return;
    buzz();
    setPicked(i);
    setTimeout(async () => { await session.play(i === q.a ? "Correct!" : "Wrong"); setQ(PUZZLES[Math.floor(Math.random() * PUZZLES.length)]); setPicked(null); }, 700);
  };
  return (
    <View style={s.col}>
      <Text style={s.hint}>Guess what these emojis mean</Text>
      <View style={s.emojiCard}><Text style={s.emojiTxt}>{q.e}</Text></View>
      <View style={s.opts}>
        {q.opts.map((o, i) => (
          <Pressable key={i} disabled={picked !== null} testID={`emoji-${i}`} style={[s.optBtn,
              picked === i && i === q.a && { backgroundColor: colors.success, borderColor: colors.success },
              picked === i && i !== q.a && { backgroundColor: colors.error, borderColor: colors.error },
            ]} onPress={() => choose(i)}>
            <Text style={[s.optTxt, picked === i && { color: "#fff" }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export const GAMES_MAP_EXTRA: Record<string, (p: { session: SessionApi }) => React.ReactElement> = {
  "rock-paper": RockPaperGame,
  "coin-flip": CoinFlipGame,
  "dice-roll": DiceRollGame,
  "odd-out": OddOneOutGame,
  "true-false": TrueFalseGame,
  "tap-counter": TapCounterGame,
  "reaction": ReactionGame,
  "simon-says": SimonSaysGame,
  "whack-mole": WhackMoleGame,
  "merge-tiles": MergeGame,
  "connect-dots": ConnectDotsGame,
  "color-sort": ColorSortGame,
  "spell-bee": SpellBeeGame,
  "trivia": TriviaGame,
  "find-pair": FindPairGame,
  "bubble-pop": BubblePopGame,
  "sequence": SequenceRecallGame,
  "lucky-dice": LuckyDiceGame,
  "shape-match": ShapeMatchGame,
  "guess-emoji": GuessEmojiGame,
};

const s = StyleSheet.create({
  col: { gap: spacing.md, flex: 1 },
  row: { flexDirection: "row", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  hint: { fontFamily: fonts.body, color: colors.textSecondary, textAlign: "center" },
  startTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 18, textAlign: "center", paddingHorizontal: 16 },
  startBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.button, marginTop: 16, ...shadows.heavy },
  startTxt: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  opts: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: spacing.md },
  optBtn: { width: "47%", padding: 16, borderRadius: radius.button, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center" },
  optTxt: { fontFamily: fonts.heading, fontSize: 15, color: colors.textPrimary },
  bigBtn: { flex: 1, minWidth: 100, paddingVertical: 18, borderRadius: radius.button, alignItems: "center", ...shadows.medium },
  bigBtnTxt: { color: "#fff", fontFamily: fonts.heading, fontSize: 16 },

  // RPS
  rpsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 20, marginVertical: 12 },
  rpsVs: { fontFamily: fonts.heading, color: colors.textSecondary, fontSize: 18 },
  slot: { alignItems: "center" },
  slotLabel: { fontFamily: fonts.body, color: colors.textTertiary, fontSize: 11, marginBottom: 6 },
  slotIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border },
  slotQ: { fontFamily: fonts.heading, color: colors.textTertiary, fontSize: 32 },
  bigResult: { textAlign: "center", fontFamily: fonts.heading, fontSize: 24, color: colors.primary },
  choiceBtn: { flex: 1, minWidth: 90, paddingVertical: 18, borderRadius: radius.button, backgroundColor: colors.primary, alignItems: "center", gap: 4, ...shadows.medium },
  choiceLbl: { color: "#fff", fontFamily: fonts.heading, fontSize: 12 },

  // Coin
  coin: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#FCD34D", alignItems: "center", justifyContent: "center", marginVertical: 16, ...shadows.heavy, borderWidth: 4, borderColor: "#F59E0B" },
  coinFace: { fontFamily: fonts.heading, fontSize: 48, color: "#92400E" },

  // Dice
  die: { width: 90, height: 90, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.primary, ...shadows.medium, marginHorizontal: 12, marginVertical: 12 },
  dieNum: { fontFamily: fonts.heading, fontSize: 40, color: colors.textPrimary },

  // Odd
  oddGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
  oddCell: { width: "30%", aspectRatio: 1, borderRadius: 12, ...shadows.light },

  // True/False
  tfCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.card, alignItems: "center", borderWidth: 2, borderColor: colors.primary, marginTop: 12 },
  tfText: { fontFamily: fonts.heading, fontSize: 28, color: colors.textPrimary },

  // Tap
  tapPad: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows.heavy, marginTop: 16 },
  tapCount: { fontFamily: fonts.heading, fontSize: 64, color: "#fff" },
  tapHint: { fontFamily: fonts.heading, color: "#fff", fontSize: 14, letterSpacing: 2 },

  // Reaction
  reactionPad: { flex: 1, marginTop: 12, borderRadius: radius.card, alignItems: "center", justifyContent: "center" },
  reactionTxt: { fontFamily: fonts.heading, color: "#fff", fontSize: 32, letterSpacing: 1 },

  // Simon
  simonGrid: { width: 260, height: 260, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  simonCell: { width: "50%", height: "50%", borderWidth: 4, borderColor: colors.background },

  // Whack
  moleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  moleHole: { width: "30%", aspectRatio: 1, borderRadius: 60, backgroundColor: "#78350F", alignItems: "center", justifyContent: "center" },
  moleUp: { backgroundColor: "#92400E" },
  moleEmoji: { fontSize: 48 },

  // Merge
  mergeRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12, flexWrap: "wrap" },
  mergeTile: { width: 60, height: 60, borderRadius: 12, alignItems: "center", justifyContent: "center", ...shadows.light },
  mergeNum: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 20 },

  // Connect
  connectBoard: { backgroundColor: colors.surface, height: 360, borderRadius: radius.card, marginTop: 12, position: "relative", borderWidth: 1, borderColor: colors.border },
  dot: { position: "absolute", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", ...shadows.light },
  dotN: { fontFamily: fonts.heading, fontSize: 16 },

  // Color Sort
  targetBin: { padding: 14, borderRadius: radius.button, alignItems: "center", marginTop: 12 },
  targetTxt: { fontFamily: fonts.heading, color: "#fff", fontSize: 14, letterSpacing: 2 },
  sortItem: { width: 60, height: 60, borderRadius: 12, ...shadows.light },

  // Spell
  spellOut: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  spellSlot: { width: 40, height: 50, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  spellSlotTxt: { fontFamily: fonts.heading, fontSize: 22 },
  spellGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 },
  spellTile: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows.light },
  spellTileTxt: { color: "#fff", fontFamily: fonts.heading, fontSize: 18 },

  // Find Pair
  pairGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 16 },
  pairCell: { width: "30%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border },
  pairTxt: { fontSize: 42 },

  // Bubble
  bubbleBoard: { flex: 1, marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.card, position: "relative", borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  bubble: { position: "absolute", width: 50, height: 50, borderRadius: 25, backgroundColor: "#60A5FA", borderWidth: 2, borderColor: "#3B82F6" },

  // Sequence
  seqShow: { backgroundColor: colors.surface, padding: 20, borderRadius: radius.card, alignItems: "center", marginTop: 12, borderWidth: 2, borderColor: colors.primary },
  seqTxt: { fontFamily: fonts.heading, fontSize: 32, color: colors.textPrimary, letterSpacing: 4 },
  seqGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 },
  seqBtn: { width: "18%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  seqBtnTxt: { fontFamily: fonts.heading, color: "#fff", fontSize: 22 },

  // Lucky Dice
  luckyDice: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  luckyDiceSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  luckyDiceTxt: { fontFamily: fonts.heading, fontSize: 20, color: colors.textPrimary },

  // Shape
  shapeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 16 },
  shapeBox: { width: "45%", padding: 14, alignItems: "center", borderRadius: radius.image, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  shapeLbl: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 12 },

  // Emoji
  emojiCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.card, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: 12, ...shadows.light },
  emojiTxt: { fontSize: 40, letterSpacing: 8 },
});
