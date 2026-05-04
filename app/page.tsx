"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMiniApp } from "./providers/MiniAppProvider";
import { stringToHex } from "viem";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import styles from "./page.module.css";

type View = "menu" | "tap" | "leaderboard" | "checkin";

interface GameState {
  score: number;
  streak: number;
  multiplier: number;
  canCheckinNow: boolean;
  todayKey: string;
  totalCheckins: number;
}

interface LeaderboardRow {
  rank: number;
  wallet: string;
  score: number;
  streak: number;
}

interface PlayerState {
  score: number;
  streak: number;
  lastCheckinDayKey: string | null;
  totalCheckins: number;
}

const STORAGE_KEY = "gruzgame02:players";
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

function shortWallet(wallet: string) {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatCountdownFromSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getMoscowDayKey(date: Date = new Date()): string {
  const moscowNow = new Date(date.getTime() + MOSCOW_OFFSET_MS);
  const y = moscowNow.getUTCFullYear();
  const m = String(moscowNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(moscowNow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const py = date.getUTCFullYear();
  const pm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(date.getUTCDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

function getSecondsToNextMoscowMidnight(): number {
  const now = Date.now();
  const moscowNow = new Date(now + MOSCOW_OFFSET_MS);
  const nextMoscowMidnightUtcMs =
    Date.UTC(
      moscowNow.getUTCFullYear(),
      moscowNow.getUTCMonth(),
      moscowNow.getUTCDate() + 1,
      0,
      0,
      0
    ) - MOSCOW_OFFSET_MS;
  return Math.max(0, Math.floor((nextMoscowMidnightUtcMs - now) / 1000));
}

function parsePlayers(): Record<string, PlayerState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlayerState>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function savePlayers(players: Record<string, PlayerState>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

export default function Home() {
  const { context } = useMiniApp();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: base.id });
  const [view, setView] = useState<View>("menu");
  const [state, setState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [countdown, setCountdown] = useState("00:00:00");
  const [error, setError] = useState("");
  const [checkedUsersCount, setCheckedUsersCount] = useState(0);
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);
  const name = useMemo(
    () => context?.user?.displayName || (address ? `Player ${address.slice(2, 6).toUpperCase()}` : "Player"),
    [context?.user?.displayName, address],
  );

  const { data: txHash, isPending: isWritePending, sendTransactionAsync } = useSendTransaction();
  const { isLoading: isTxMining, isSuccess: isTxMined } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  const updateLeaderboard = useCallback(() => {
    const players = parsePlayers();
    const rows = Object.entries(players)
      .map(([wallet, player]) => ({
        wallet,
        score: player.score,
        streak: player.streak,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((row, index) => ({
        rank: index + 1,
        wallet: row.wallet,
        score: row.score,
        streak: row.streak,
      }));
    setLeaderboard(rows);
    setCheckedUsersCount(Object.values(players).filter((player) => player.totalCheckins > 0).length);
  }, []);

  const fetchState = useCallback(async () => {
    if (!address) return;
    try {
      const players = parsePlayers();
      const key = address.toLowerCase();
      const todayKey = getMoscowDayKey();
      const player = players[key] ?? {
        score: 0,
        streak: 0,
        lastCheckinDayKey: null,
        totalCheckins: 0,
      };
      const canCheckinNow = player.lastCheckinDayKey !== todayKey;

      setState({
        score: player.score,
        streak: player.streak,
        multiplier: 1 + player.streak * 0.1,
        canCheckinNow,
        todayKey,
        totalCheckins: player.totalCheckins,
      });
      setCountdown(formatCountdownFromSeconds(getSecondsToNextMoscowMidnight()));
      updateLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка чтения локального состояния.");
    }
  }, [address, updateLeaderboard]);

  useEffect(() => {
    if (!isConnected || !address) return;
    setError("");
    void fetchState();
  }, [isConnected, address, fetchState]);

  useEffect(() => {
    let remaining = getSecondsToNextMoscowMidnight();
    const tick = () => {
      setCountdown(formatCountdownFromSeconds(remaining));
      if (remaining <= 0) {
        remaining = getSecondsToNextMoscowMidnight();
        void fetchState();
      } else {
        remaining = Math.max(0, remaining - 1);
      }
    };
    tick();
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    const refreshAfterTx = async () => {
      if (!isTxMined || !isSubmittingCheckin || !address) return;
      const players = parsePlayers();
      const key = address.toLowerCase();
      const todayKey = getMoscowDayKey();
      const previousDayKey = getPreviousDayKey(todayKey);
      const player = players[key] ?? {
        score: 0,
        streak: 0,
        lastCheckinDayKey: null,
        totalCheckins: 0,
      };

      if (player.lastCheckinDayKey !== todayKey) {
        const nextStreak = player.lastCheckinDayKey === previousDayKey ? player.streak + 1 : 1;
        players[key] = {
          ...player,
          streak: nextStreak,
          lastCheckinDayKey: todayKey,
          totalCheckins: player.totalCheckins + 1,
        };
        savePlayers(players);
      }

      setIsSubmittingCheckin(false);
      await fetchState();
    };
    void refreshAfterTx();
  }, [address, fetchState, isSubmittingCheckin, isTxMined]);

  const handleTap = () => {
    if (!state || !address) return;
    const players = parsePlayers();
    const key = address.toLowerCase();
    const player = players[key] ?? {
      score: 0,
      streak: 0,
      lastCheckinDayKey: null,
      totalCheckins: 0,
    };

    const nextScore = Number((player.score + (1 + player.streak * 0.1)).toFixed(2));
    players[key] = { ...player, score: nextScore };
    savePlayers(players);

    setState((prev) =>
      prev
        ? {
            ...prev,
            score: nextScore,
          }
        : prev,
    );
    updateLeaderboard();
  };

  const handleCheckin = async () => {
    if (!address || !state?.canCheckinNow || !publicClient) return;
    setError("");
    try {
      setIsSubmittingCheckin(true);
      await sendTransactionAsync({
        to: address,
        data: stringToHex(`gruzgame02-checkin:${Date.now()}`),
        value: BigInt(0),
        chainId: base.id,
      });
    } catch (err) {
      setIsSubmittingCheckin(false);
      setError(err instanceof Error ? err.message : "Не удалось отправить ончейн check-in транзакцию.");
    }
  };

  const isBusy = isWritePending || isTxMining || isSubmittingCheckin;
  const isCorrectChain = chainId === base.id;
  const multiplier = state ? state.multiplier : 1;

  return (
    <main className={styles.container}>
      <div className={styles.sunsetLayer} />
      <div className={styles.cityLayer} />
      <div className={styles.gridLayer} />

      <section className={styles.card}>
        <h1 className={styles.title}>ROBO TAP // 02</h1>
        {!isConnected || !address ? (
          <p className={styles.warning}>Открой игру в Base App для авто-подключения кошелька.</p>
        ) : !isCorrectChain ? (
          <p className={styles.warning}>Переключите сеть кошелька на Base Mainnet.</p>
        ) : (
          <div className={styles.playerLine}>
            <span>{name}</span>
            <span>{shortWallet(address)}</span>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.scorePanel}>
          <div>
            <p className={styles.metaLabel}>Очки</p>
            <p className={styles.metaValue}>{state?.score.toFixed(2) ?? "0.00"}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Streak</p>
            <p className={styles.metaValue}>{state?.streak ?? 0}</p>
          </div>
          <div>
            <p className={styles.metaLabel}>Множитель</p>
            <p className={styles.metaValue}>x{multiplier.toFixed(2)} </p>
          </div>
        </div>

        <p className={styles.hint}>Уникальных пользователей с check-in: {checkedUsersCount}</p>

        {view === "menu" && (
          <div className={styles.menuButtons}>
            <button className={styles.neonButton} onClick={() => setView("leaderboard")} type="button">
              Лидерборд
            </button>
            <button className={styles.neonButton} onClick={() => setView("checkin")} type="button">
              Ончейн чек-ин
            </button>
            <button className={styles.neonButton} onClick={() => setView("tap")} type="button">
              Начать тапать
            </button>
          </div>
        )}

        {view === "tap" && (
          <div className={styles.viewBlock}>
            <button className={styles.robotButton} type="button" onClick={handleTap} disabled={!state || isBusy || !isCorrectChain}>
              <span className={styles.robotIcon}>🤖</span>
              <span className={styles.robotCaption}>ТАПАЙ РОБОТА</span>
            </button>
            <p className={styles.hint}>Базовый тап = 1 очко. Каждый check-in добавляет +10% к тапу.</p>
          </div>
        )}

        {view === "checkin" && (
          <div className={styles.viewBlock}>
            <p className={styles.checkinText}>
              Следующий reset check-in: <strong>00:00 МСК</strong>
            </p>
            <p className={styles.timer}>{countdown}</p>
            <button
              className={styles.neonButton}
              type="button"
              onClick={() => void handleCheckin()}
              disabled={!state?.canCheckinNow || isBusy || !address || !isCorrectChain}
            >
              {isBusy
                ? "Транзакция..."
                : state?.canCheckinNow
                  ? "Сделать ончейн check-in"
                  : "Чек-ин уже сделан сегодня"}
            </button>
            {txHash && <p className={styles.hint}>Tx: {shortWallet(txHash)}</p>}
            <p className={styles.hint}>Всего твоих check-in: {state?.totalCheckins ?? 0}</p>
          </div>
        )}

        {view === "leaderboard" && (
          <div className={styles.viewBlock}>
            <button className={styles.smallButton} type="button" onClick={() => updateLeaderboard()}>
              Обновить
            </button>
            <div className={styles.leaderboard}>
              {leaderboard.length === 0 ? (
                <p className={styles.hint}>Пока нет игроков. Станьте первым!</p>
              ) : (
                leaderboard.map((row) => (
                  <div className={styles.leaderboardRow} key={`${row.wallet}-${row.rank}`}>
                    <span>#{row.rank}</span>
                    <span>{shortWallet(row.wallet)}</span>
                    <span>{row.score.toFixed(2)} / x{(1 + row.streak * 0.1).toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view !== "menu" && (
          <button className={styles.backButton} type="button" onClick={() => setView("menu")} disabled={isBusy}>
            В меню
          </button>
        )}
      </section>
    </main>
  );
}
