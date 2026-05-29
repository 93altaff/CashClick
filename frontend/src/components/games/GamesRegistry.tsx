// Real playable mini-games. Each component renders inside the GameShell.
// All games call session.play() when a round completes and award backend points.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";

type SessionApi = {
  play: (label?: string) => Promise<number | null>;
  submitting: boolean;
};

const buzz = (kind: "light" | "med" | "heavy" = "light") => {
  try {
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      med: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    Haptics.impactAsync(map[kind]);
  } catch {}
};

// ===== 1. Higher Lower =====
export function HigherLowerGame({ session }: { session: SessionApi }) {
  const [current, setCurrent] = useState<number>(() => Math.floor(Math.random() * 9) + 2);
  const [next, setNext] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const TOTAL = 3;

  const guess = async (g: "higher" | "lower") => {
    buzz();
    let n = Math.floor(Math.random() * 10) + 1;
    while (n === current) n = Math.floor(Math.random() * 10) + 1;
    setNext(n);
    const win = g === "higher" ? n > current : n < current;
    setTimeout(async () => {
      const c = win ? correct + 1 : correct;
      setCorrect(c);
      if (round >= TOTAL) {
        await session.play(`${c}/${TOTAL} correct`);
        // reset after popup close handled by parent
        setRound(1); setCorrect(0);
        setCurrent(Math.floor(Math.random() * 9) + 2); setNext(null);
      } else {
        setRound(round + 1);
        setCurrent(n); setNext(null);
      }
    }, 800);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Round {round}/{TOTAL} · Will the next be higher or lower?</Text>
      <View style={styles.cardRow}>
        <View style={[styles.numberCard, { borderColor: "#10B981" }]}>
          <Text style={styles.numberBig}>{current}</Text>
          <Text style={styles.numberLabel}>Current</Text>
        </View>
        <Feather name="arrow-right" size={28} color={colors.textTertiary} />
        <View style={[styles.numberCard, { borderColor: "#3B82F6", borderStyle: next ? "solid" : "dashed" }]}>
          <Text style={styles.numberBig}>{next ?? "?"}</Text>
          <Text style={styles.numberLabel}>Next</Text>
        </View>
      </View>
      <View style={styles.btnRow}>
        <Pressable testID="hl-higher" disabled={!!next || session.submitting} style={[styles.guessBtn, { backgroundColor: "#10B981" }]} onPress={() => guess("higher")}>
          <Feather name="arrow-up" size={20} color="#fff" />
          <Text style={styles.guessText}>Higher</Text>
        </Pressable>
        <Pressable testID="hl-lower" disabled={!!next || session.submitting} style={[styles.guessBtn, { backgroundColor: "#EF4444" }]} onPress={() => guess("lower")}>
          <Feather name="arrow-down" size={20} color="#fff" />
          <Text style={styles.guessText}>Lower</Text>
        </Pressable>
      </View>
      <Text style={styles.scoreLine}>Correct: {correct}/{round - 1}</Text>
    </View>
  );
}

// ===== 2. Memory Match =====
export function MemoryMatchGame({ session }: { session: SessionApi }) {
  const ICONS = ["heart", "star", "moon", "sun", "cloud", "zap"];
  const buildDeck = useCallback(() => {
    const deck = [...ICONS, ...ICONS].map((icon, i) => ({ id: i, icon, matched: false }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }, []);
  const [deck, setDeck] = useState(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const onTap = (idx: number) => {
    if (flipped.includes(idx) || deck[idx].matched || flipped.length === 2) return;
    buzz();
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(moves + 1);
      const [a, b] = next;
      if (deck[a].icon === deck[b].icon) {
        setTimeout(() => {
          const nd = deck.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
          setDeck(nd); setFlipped([]);
          if (nd.every((c) => c.matched)) {
            (async () => {
              await session.play(`Solved in ${moves + 1} moves`);
              setDeck(buildDeck()); setMoves(0);
            })();
          }
        }, 400);
      } else {
        setTimeout(() => setFlipped([]), 700);
      }
    }
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Find all matching pairs · Moves: {moves}</Text>
      <View style={styles.memGrid}>
        {deck.map((c, i) => {
          const shown = flipped.includes(i) || c.matched;
          return (
            <Pressable key={c.id} testID={`mem-${i}`} style={[styles.memCard, shown && styles.memCardFlipped, c.matched && { opacity: 0.5 }]} onPress={() => onTap(i)}>
              {shown ? <Feather name={c.icon as any} size={26} color={colors.primaryDark} /> : <Feather name="help-circle" size={20} color="#fff" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ===== 3. Tic Tac Toe vs CPU =====
export function TicTacToeGame({ session }: { session: SessionApi }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [status, setStatus] = useState<"playing" | "win" | "lose" | "draw">("playing");

  const checkWin = (b: (string | null)[]): string | "draw" | null => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,c,d] of lines) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]!;
    if (b.every(Boolean)) return "draw";
    return null;
  };

  const cpuMove = useCallback((b: (string | null)[]) => {
    // simple AI: win, block, center, random
    for (const sym of ["O", "X"]) {
      for (let i = 0; i < 9; i++) {
        if (!b[i]) { const t = [...b]; t[i] = sym; if (checkWin(t) === sym) return i; }
      }
    }
    if (!b[4]) return 4;
    const empty = b.map((v, i) => v ? null : i).filter((x): x is number => x !== null);
    return empty[Math.floor(Math.random() * empty.length)];
  }, []);

  const tap = (i: number) => {
    if (board[i] || status !== "playing" || turn !== "X") return;
    buzz();
    const b = [...board]; b[i] = "X"; setBoard(b);
    const r = checkWin(b);
    if (r === "X") { setStatus("win"); finish(true); return; }
    if (r === "draw") { setStatus("draw"); finish(true); return; }
    setTurn("O");
    setTimeout(() => {
      const cm = cpuMove(b); if (cm === undefined) return;
      const b2 = [...b]; b2[cm] = "O"; setBoard(b2);
      const r2 = checkWin(b2);
      if (r2 === "O") { setStatus("lose"); finish(false); }
      else if (r2 === "draw") { setStatus("draw"); finish(true); }
      else setTurn("X");
    }, 400);
  };

  const finish = async (won: boolean) => {
    await session.play(won ? "You won!" : "Tough one!");
    setBoard(Array(9).fill(null)); setTurn("X"); setStatus("playing");
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>You are X · Beat the CPU!</Text>
      <View style={styles.tttBoard}>
        {board.map((v, i) => (
          <Pressable key={i} testID={`ttt-${i}`} style={styles.tttCell} onPress={() => tap(i)}>
            {v ? <Text style={[styles.tttMark, { color: v === "X" ? colors.primary : colors.error }]}>{v}</Text> : null}
          </Pressable>
        ))}
      </View>
      <Text style={styles.scoreLine}>{status === "playing" ? `Turn: ${turn}` : status === "win" ? "You win!" : status === "lose" ? "CPU wins" : "Draw"}</Text>
    </View>
  );
}

// ===== 4. Math Sprint =====
export function MathSprintGame({ session }: { session: SessionApi }) {
  const gen = () => {
    const a = Math.floor(Math.random() * 12) + 1;
    const b = Math.floor(Math.random() * 12) + 1;
    const op = ["+", "-", "×"][Math.floor(Math.random() * 3)] as "+" | "-" | "×";
    const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const opts = new Set<number>([ans]);
    while (opts.size < 4) opts.add(ans + Math.floor(Math.random() * 11) - 5);
    return { a, b, op, ans, opts: Array.from(opts).sort(() => Math.random() - 0.5) };
  };
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const TOTAL = 5;

  const choose = (v: number) => {
    if (picked !== null) return;
    buzz(v === q.ans ? "med" : "light");
    setPicked(v);
    setTimeout(async () => {
      const c = correct + (v === q.ans ? 1 : 0);
      setCorrect(c);
      if (round >= TOTAL) {
        await session.play(`${c}/${TOTAL} correct`);
        setRound(1); setCorrect(0); setQ(gen()); setPicked(null);
      } else {
        setRound(round + 1); setQ(gen()); setPicked(null);
      }
    }, 700);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Question {round}/{TOTAL}</Text>
      <View style={styles.mathCard}>
        <Text style={styles.mathQ}>{q.a} {q.op} {q.b} = ?</Text>
      </View>
      <View style={styles.optsGrid}>
        {q.opts.map((o, i) => (
          <Pressable
            key={i}
            testID={`math-opt-${i}`}
            disabled={picked !== null}
            style={[
              styles.optBtn,
              picked === o && (o === q.ans ? { backgroundColor: colors.success, borderColor: colors.success } : { backgroundColor: colors.error, borderColor: colors.error }),
              picked !== null && picked !== o && o === q.ans && { borderColor: colors.success, backgroundColor: colors.primaryLight },
            ]}
            onPress={() => choose(o)}
          >
            <Text style={[styles.optText, picked === o && { color: "#fff" }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.scoreLine}>Correct: {correct}</Text>
    </View>
  );
}

// ===== 5. Puzzle Solve (4-tile slide) =====
export function PuzzleSolveGame({ session }: { session: SessionApi }) {
  const SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  const shuffle = () => {
    let arr = [...SOLVED];
    // do random valid moves to ensure solvable
    for (let i = 0; i < 40; i++) {
      const empty = arr.indexOf(0);
      const opts = neighbors(empty);
      const swap = opts[Math.floor(Math.random() * opts.length)];
      [arr[empty], arr[swap]] = [arr[swap], arr[empty]];
    }
    return arr;
  };
  const neighbors = (i: number): number[] => {
    const r = Math.floor(i / 3), c = i % 3, out: number[] = [];
    if (r > 0) out.push(i - 3); if (r < 2) out.push(i + 3);
    if (c > 0) out.push(i - 1); if (c < 2) out.push(i + 1);
    return out;
  };
  const [tiles, setTiles] = useState(shuffle);
  const [moves, setMoves] = useState(0);

  const tap = (i: number) => {
    const empty = tiles.indexOf(0);
    if (!neighbors(empty).includes(i)) return;
    buzz();
    const nt = [...tiles]; [nt[empty], nt[i]] = [nt[i], nt[empty]];
    setTiles(nt); setMoves(moves + 1);
    if (nt.every((v, idx) => v === SOLVED[idx])) {
      (async () => { await session.play(`Solved in ${moves + 1} moves`); setTiles(shuffle()); setMoves(0); })();
    }
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Arrange 1-8 · Moves: {moves}</Text>
      <View style={styles.puzzleGrid}>
        {tiles.map((v, i) => (
          <Pressable key={i} testID={`puzzle-${i}`} style={[styles.puzzleTile, v === 0 && { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => tap(i)}>
            {v !== 0 && <Text style={styles.puzzleNum}>{v}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ===== 6. Color Tap (Stroop-like) =====
export function ColorTapGame({ session }: { session: SessionApi }) {
  const WORDS = ["RED", "GREEN", "BLUE", "YELLOW", "PURPLE"];
  const COLORS_MAP: Record<string, string> = { RED: "#EF4444", GREEN: "#10B981", BLUE: "#3B82F6", YELLOW: "#F59E0B", PURPLE: "#8B5CF6" };
  const gen = () => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    let color = WORDS[Math.floor(Math.random() * WORDS.length)];
    while (color === word && Math.random() > 0.5) color = WORDS[Math.floor(Math.random() * WORDS.length)];
    const opts = Array.from(new Set([color, ...WORDS])).slice(0, 4).sort(() => Math.random() - 0.5);
    return { word, color, opts };
  };
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const TOTAL = 5;

  const choose = (c: string) => {
    buzz();
    const win = c === q.color;
    setTimeout(async () => {
      const nc = correct + (win ? 1 : 0);
      setCorrect(nc);
      if (round >= TOTAL) {
        await session.play(`${nc}/${TOTAL} correct`);
        setRound(1); setCorrect(0); setQ(gen());
      } else {
        setRound(round + 1); setQ(gen());
      }
    }, 400);
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Round {round}/{TOTAL} · Pick the COLOR (not the word)</Text>
      <View style={styles.colorWord}>
        <Text style={[styles.colorWordTxt, { color: COLORS_MAP[q.color] }]}>{q.word}</Text>
      </View>
      <View style={styles.colorOpts}>
        {q.opts.map((o) => (
          <Pressable key={o} testID={`color-${o}`} style={[styles.colorBtn, { backgroundColor: COLORS_MAP[o] }]} onPress={() => choose(o)}>
            <Text style={styles.colorBtnTxt}>{o}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.scoreLine}>Correct: {correct}</Text>
    </View>
  );
}

// ===== 7. Word Scramble =====
export function WordScrambleGame({ session }: { session: SessionApi }) {
  const WORDS = ["MONEY", "REWARD", "POINTS", "GAMES", "CASH", "EARN", "BONUS", "PRIZE", "DAILY", "LUCKY", "WINNER", "INDIA"];
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const [target, setTarget] = useState(pick);
  const [scrambled, setScrambled] = useState(() => target.split("").sort(() => Math.random() - 0.5));
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    setScrambled(target.split("").sort(() => Math.random() - 0.5));
    setPicked([]); setWrong(false);
  }, [target]);

  const pickLetter = (i: number) => {
    if (picked.includes(i)) return;
    buzz();
    const np = [...picked, i]; setPicked(np);
    if (np.length === target.length) {
      const guess = np.map((idx) => scrambled[idx]).join("");
      if (guess === target) {
        (async () => { await session.play("Word unscrambled!"); setTarget(pick()); })();
      } else {
        setWrong(true);
        setTimeout(() => { setPicked([]); setWrong(false); }, 800);
      }
    }
  };

  return (
    <View style={styles.column}>
      <Text style={styles.hint}>Unscramble the letters · {target.length} letters</Text>
      <View style={styles.wordBoxes}>
        {target.split("").map((_, i) => {
          const idx = picked[i];
          const ch = idx !== undefined ? scrambled[idx] : "";
          return (
            <View key={i} style={[styles.wordBox, wrong && { borderColor: colors.error }]}>
              <Text style={styles.wordBoxTxt}>{ch}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.wordPickRow}>
        {scrambled.map((c, i) => (
          <Pressable
            key={i}
            testID={`word-pick-${i}`}
            disabled={picked.includes(i)}
            style={[styles.wordPick, picked.includes(i) && { opacity: 0.3 }]}
            onPress={() => pickLetter(i)}
          >
            <Text style={styles.wordPickTxt}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.resetBtn} onPress={() => { setPicked([]); setWrong(false); }}>
        <Feather name="rotate-ccw" size={14} color={colors.textSecondary} />
        <Text style={styles.resetTxt}>Reset</Text>
      </Pressable>
    </View>
  );
}

// ===== 8. Fruit Slice (timed taps) =====
export function FruitSliceGame({ session }: { session: SessionApi }) {
  const FRUITS = ["🍎", "🍊", "🍌", "🍇", "🍉", "🍓", "🍑", "🥝", "🍒"];
  const [target, setTarget] = useState(() => Math.floor(Math.random() * 9));
  const [time, setTime] = useState(15);
  const [score, setScore] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (time <= 0) {
      setActive(false);
      (async () => { await session.play(`Score: ${score}`); setScore(0); })();
      return;
    }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, active, score, session]);

  const tap = (i: number) => {
    if (!active) return;
    if (i === target) { buzz("med"); setScore(score + 1); setTarget(Math.floor(Math.random() * 9)); }
    else { buzz("light"); setScore(Math.max(0, score - 1)); }
  };

  if (!active) {
    return (
      <View style={[styles.column, { justifyContent: "center", alignItems: "center", flex: 1 }]}>
        <Text style={styles.startTitle}>Tap the matching fruit as fast as possible!</Text>
        <Text style={styles.hint}>15 seconds · +1 right · -1 wrong</Text>
        <Pressable testID="fruit-start" style={styles.startBtn} onPress={() => { setActive(true); setTime(15); setScore(0); }}>
          <Text style={styles.startText}>Start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.column}>
      <View style={styles.gameMetaRow}>
        <Text style={styles.hint}>Time: {time}s</Text>
        <Text style={styles.hint}>Score: {score}</Text>
      </View>
      <View style={styles.targetCard}>
        <Text style={styles.hint}>Tap this fruit:</Text>
        <Text style={styles.fruitBig}>{FRUITS[target]}</Text>
      </View>
      <View style={styles.fruitGrid}>
        {FRUITS.map((f, i) => (
          <Pressable key={i} testID={`fruit-${i}`} style={styles.fruitCell} onPress={() => tap(i)}>
            <Text style={styles.fruitCellTxt}>{f}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ===== 9. Lucky Spin (in-game roulette) =====
export function LuckySpinGame({ session }: { session: SessionApi }) {
  const COLORS_R = ["#10B981", "#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
  const [spinning, setSpinning] = useState(false);
  const rot = useRef(new Animated.Value(0)).current;
  const [pick, setPick] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);

  const spin = () => {
    if (choice === null) return;
    setSpinning(true);
    const target = Math.floor(Math.random() * 8);
    setPick(target);
    rot.setValue(0);
    const finalValue = 6 + (8 - target) / 8; // 6 full rotations + landing offset
    Animated.timing(rot, {
      toValue: finalValue,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      await session.play(target === choice ? `You guessed it! Color ${target + 1}` : `Landed on ${target + 1}`);
      setSpinning(false); setChoice(null); setPick(null);
    });
  };

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"], extrapolate: "extend" });

  return (
    <View style={[styles.column, { alignItems: "center" }]}>
      <Text style={styles.hint}>Pick a color, then spin!</Text>
      <View style={styles.luckyColors}>
        {COLORS_R.map((c, i) => (
          <Pressable key={i} testID={`lucky-${i}`} disabled={spinning} style={[styles.luckyChip, { backgroundColor: c }, choice === i && styles.luckyChipSel]} onPress={() => setChoice(i)}>
            <Text style={styles.luckyChipTxt}>{i + 1}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.spinWrap}>
        <Animated.View style={[styles.spinWheel, { transform: [{ rotate }] }]}>
          {COLORS_R.map((c, i) => (
            <View key={i} style={[styles.spinSector, { backgroundColor: c, transform: [{ rotate: `${(360 / 8) * i}deg` }] }]} />
          ))}
          <View style={styles.spinCenter}><Feather name="award" size={22} color={colors.secondary} /></View>
        </Animated.View>
        <View style={styles.spinPointer} />
      </View>
      <Pressable testID="lucky-spin" style={[styles.startBtn, (spinning || choice === null) && { opacity: 0.5 }]} onPress={spin} disabled={spinning || choice === null}>
        <Text style={styles.startText}>{spinning ? "Spinning..." : "SPIN"}</Text>
      </Pressable>
    </View>
  );
}

// ===== 10. Card Flip (3 doors) =====
export function CardFlipGame({ session }: { session: SessionApi }) {
  const [cards, setCards] = useState<("win" | "lose")[]>(["win", "lose", "lose"].sort(() => Math.random() - 0.5));
  const [picked, setPicked] = useState<number | null>(null);

  const pick = async (i: number) => {
    if (picked !== null) return;
    buzz("med");
    setPicked(i);
    const won = cards[i] === "win";
    setTimeout(async () => {
      await session.play(won ? "You found the prize!" : "Better luck next round");
      setCards(["win", "lose", "lose"].sort(() => Math.random() - 0.5));
      setPicked(null);
    }, 1100);
  };

  return (
    <View style={[styles.column, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
      <Text style={styles.hint}>Pick the card hiding the prize</Text>
      <View style={styles.cardFlipRow}>
        {cards.map((c, i) => {
          const open = picked === i;
          return (
            <Pressable key={i} testID={`card-${i}`} style={[styles.flipCard, open && (c === "win" ? styles.flipCardWin : styles.flipCardLose)]} onPress={() => pick(i)}>
              {open ? (
                <Feather name={c === "win" ? "award" : "x"} size={42} color="#fff" />
              ) : (
                <Feather name="help-circle" size={36} color="#fff" />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ===== 11. Number Rush (tap 1-9 in order) =====
export function NumberRushGame({ session }: { session: SessionApi }) {
  const buildBoard = () => Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  const [board, setBoard] = useState(buildBoard);
  const [next, setNext] = useState(1);
  const [time, setTime] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTime((s) => s + 0.1), 100);
    return () => clearInterval(t);
  }, [active]);

  const tap = (n: number) => {
    if (!active) return;
    if (n !== next) { buzz(); return; }
    buzz("med");
    if (n === 9) {
      setActive(false);
      (async () => { await session.play(`Finished in ${time.toFixed(1)}s`); setBoard(buildBoard()); setNext(1); setTime(0); })();
    } else {
      setNext(next + 1);
    }
  };

  if (!active) {
    return (
      <View style={[styles.column, { alignItems: "center", justifyContent: "center", flex: 1 }]}>
        <Text style={styles.startTitle}>Tap 1 through 9 in order — as fast as you can!</Text>
        <Pressable testID="rush-start" style={styles.startBtn} onPress={() => { setBoard(buildBoard()); setActive(true); setNext(1); setTime(0); }}>
          <Text style={styles.startText}>Start</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.column}>
      <View style={styles.gameMetaRow}>
        <Text style={styles.hint}>Tap: {next}</Text>
        <Text style={styles.hint}>Time: {time.toFixed(1)}s</Text>
      </View>
      <View style={styles.rushGrid}>
        {board.map((n, i) => (
          <Pressable key={i} testID={`rush-${n}`} style={[styles.rushCell, n < next && { opacity: 0.3 }]} onPress={() => tap(n)} disabled={n < next}>
            <Text style={styles.rushNum}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// =========================================================
// Registry & Styles
// =========================================================
export const GAMES_MAP: Record<string, (p: { session: SessionApi }) => React.ReactElement> = {
  "higher-lower": HigherLowerGame,
  "memory-match": MemoryMatchGame,
  "tic-tac-toe": TicTacToeGame,
  "math-sprint": MathSprintGame,
  "puzzle-solve": PuzzleSolveGame,
  "color-tap": ColorTapGame,
  "word-scramble": WordScrambleGame,
  "fruit-slice": FruitSliceGame,
  "lucky-spin": LuckySpinGame,
  "card-flip": CardFlipGame,
  "number-rush": NumberRushGame,
};

const styles = StyleSheet.create({
  column: { gap: spacing.md, flex: 1 },
  hint: { fontFamily: fonts.body, color: colors.textSecondary, textAlign: "center" },
  scoreLine: { textAlign: "center", color: colors.textSecondary, fontFamily: fonts.heading, marginTop: 4 },
  gameMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  startTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 18, textAlign: "center", paddingHorizontal: 16 },
  startBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.button, marginTop: 16, ...shadows.heavy },
  startText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },

  // Higher Lower
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 12 },
  numberCard: { width: 110, height: 130, borderRadius: radius.card, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, ...shadows.light },
  numberBig: { fontFamily: fonts.heading, fontSize: 48, color: colors.textPrimary },
  numberLabel: { fontFamily: fonts.regular, color: colors.textTertiary, fontSize: 11, marginTop: 4 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: spacing.lg },
  guessBtn: { flex: 1, paddingVertical: 16, borderRadius: radius.button, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, ...shadows.heavy },
  guessText: { color: "#fff", fontFamily: fonts.heading, fontSize: 16 },

  // Memory Match
  memGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  memCard: { width: "23%", aspectRatio: 1, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows.light },
  memCardFlipped: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },

  // Tic Tac Toe
  tttBoard: { width: 280, height: 280, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", borderRadius: radius.card, backgroundColor: colors.surface, padding: 8, ...shadows.medium, marginTop: 8 },
  tttCell: { width: "33.33%", height: "33.33%", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  tttMark: { fontFamily: fonts.heading, fontSize: 56 },

  // Math Sprint
  mathCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.card, alignItems: "center", borderWidth: 2, borderColor: colors.primary, ...shadows.medium, marginTop: 8 },
  mathQ: { fontFamily: fonts.heading, fontSize: 36, color: colors.textPrimary },
  optsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "center" },
  optBtn: { width: "47%", padding: 18, borderRadius: radius.button, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, alignItems: "center" },
  optText: { fontFamily: fonts.heading, fontSize: 20, color: colors.textPrimary },

  // Puzzle
  puzzleGrid: { width: 270, alignSelf: "center", flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.primaryLight, padding: 6, borderRadius: radius.card, gap: 6, marginTop: 8 },
  puzzleTile: { width: 80, height: 80, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.primaryDark },
  puzzleNum: { fontFamily: fonts.heading, color: "#fff", fontSize: 28 },

  // Color Tap
  colorWord: { backgroundColor: colors.surface, paddingVertical: 36, borderRadius: radius.card, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: 8, ...shadows.medium },
  colorWordTxt: { fontFamily: fonts.heading, fontSize: 56, letterSpacing: 2 },
  colorOpts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "center" },
  colorBtn: { width: "47%", paddingVertical: 18, borderRadius: radius.button, alignItems: "center", ...shadows.light },
  colorBtnTxt: { color: "#fff", fontFamily: fonts.heading, fontSize: 16 },

  // Word Scramble
  wordBoxes: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8 },
  wordBox: { width: 40, height: 50, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  wordBoxTxt: { fontFamily: fonts.heading, fontSize: 22, color: colors.textPrimary },
  wordPickRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 },
  wordPick: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows.light },
  wordPickTxt: { fontFamily: fonts.heading, color: "#fff", fontSize: 20 },
  resetBtn: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 12, padding: 8 },
  resetTxt: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },

  // Fruit Slice
  targetCard: { backgroundColor: colors.surface, paddingVertical: 18, borderRadius: radius.card, alignItems: "center", borderWidth: 1, borderColor: colors.border, marginTop: 8, ...shadows.light },
  fruitBig: { fontSize: 56 },
  fruitGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  fruitCell: { width: "30%", aspectRatio: 1, borderRadius: radius.image, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, ...shadows.light },
  fruitCellTxt: { fontSize: 36 },

  // Lucky Spin
  luckyColors: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginVertical: 12 },
  luckyChip: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  luckyChipSel: { borderWidth: 3, borderColor: "#fff", ...shadows.heavy },
  luckyChipTxt: { color: "#fff", fontFamily: fonts.heading },
  spinWrap: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  spinWheel: { width: 200, height: 200, borderRadius: 100, backgroundColor: "#fff", overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 6, borderColor: colors.secondary, ...shadows.heavy },
  spinSector: { position: "absolute", left: "50%", top: 0, width: "50%", height: "50%", transformOrigin: "0% 100%" },
  spinCenter: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", zIndex: 2 },
  spinPointer: { position: "absolute", top: -8, width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 18, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.secondary, zIndex: 3 },

  // Card Flip
  cardFlipRow: { flexDirection: "row", gap: 14, marginTop: spacing.lg },
  flipCard: { width: 90, height: 130, borderRadius: 14, backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center", ...shadows.heavy },
  flipCardWin: { backgroundColor: colors.success },
  flipCardLose: { backgroundColor: "#94A3B8" },

  // Number Rush
  rushGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  rushCell: { width: "30%", aspectRatio: 1, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadows.medium },
  rushNum: { fontFamily: fonts.heading, fontSize: 32, color: "#fff" },
});
