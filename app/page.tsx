"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMiniApp } from "./providers/MiniAppProvider";
import { encodeFunctionData, parseEther } from "viem";
import { base } from "wagmi/chains";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import {
  ROBO_TAPPER_CHECKIN_PRICE_ETH,
  getRoboTapperContractAddress,
  roboTapperOnchainAbi,
  withRoboTapperBuilderCodeDataSuffix,
} from "@/lib/contracts/roboTapperOnchain";
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
  lastCheckinSlot: number | null;
  totalCheckins: number;
}

const STORAGE_KEY = "gruzgame02:players";
const CHECKIN_INTERVAL_SECONDS = 2 * 60;

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

function getCurrentCheckinSlot(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / (CHECKIN_INTERVAL_SECONDS * 1000));
}

function getSecondsToNextCheckinWindow(nowMs: number = Date.now()): number {
  const nowSeconds = Math.floor(nowMs / 1000);
  const remainder = nowSeconds % CHECKIN_INTERVAL_SECONDS;
  return remainder === 0 ? CHECKIN_INTERVAL_SECONDS : CHECKIN_INTERVAL_SECONDS - remainder;
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
  const contractAddress = getRoboTapperContractAddress();
  const [view, setView] = useState<View>("menu");
  const [state, setState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [countdown, setCountdown] = useState("00:00:00");
  const [error, setError] = useState("");
  const [checkedUsersCount, setCheckedUsersCount] = useState(0);
  const [pendingTaps, setPendingTaps] = useState(0);
  const [isSubmittingTap, setIsSubmittingTap] = useState(false);
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
      const currentSlot = getCurrentCheckinSlot();
      const player = players[key] ?? {
        score: 0,
        streak: 0,
        lastCheckinSlot: null,
        totalCheckins: 0,
      };
      const canCheckinNow = player.lastCheckinSlot !== currentSlot;

      setState({
        score: player.score,
        streak: player.streak,
        multiplier: 1 + player.streak * 0.1,
        canCheckinNow,
        todayKey: String(currentSlot),
        totalCheckins: player.totalCheckins,
      });
      setCountdown(formatCountdownFromSeconds(getSecondsToNextCheckinWindow()));
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
    let remaining = getSecondsToNextCheckinWindow();
    const tick = () => {
      setCountdown(formatCountdownFromSeconds(remaining));
      if (remaining <= 0) {
        remaining = getSecondsToNextCheckinWindow();
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
      const currentSlot = getCurrentCheckinSlot();
      const previousSlot = currentSlot - 1;
      const player = players[key] ?? {
        score: 0,
        streak: 0,
        lastCheckinSlot: null,
        totalCheckins: 0,
      };

      if (player.lastCheckinSlot !== currentSlot) {
        const nextStreak = player.lastCheckinSlot === previousSlot ? player.streak + 1 : 1;
        players[key] = {
          ...player,
          streak: nextStreak,
          lastCheckinSlot: currentSlot,
          totalCheckins: player.totalCheckins + 1,
        };
        savePlayers(players);
      }

      setIsSubmittingCheckin(false);
      await fetchState();
    };
    void refreshAfterTx();
  }, [address, fetchState, isSubmittingCheckin, isTxMined]);

  useEffect(() => {
    const refreshAfterTapTx = async () => {
      if (!isTxMined || !isSubmittingTap || !address || pendingTaps <= 0) return;
      const players = parsePlayers();
      const key = address.toLowerCase();
      const player = players[key] ?? {
        score: 0,
        streak: 0,
        lastCheckinSlot: null,
        totalCheckins: 0,
      };
      const tapPoints = pendingTaps * (1 + player.streak * 0.1);
      players[key] = {
        ...player,
        score: Number((player.score + tapPoints).toFixed(2)),
      };
      savePlayers(players);
      setPendingTaps(0);
      setIsSubmittingTap(false);
      await fetchState();
    };
    void refreshAfterTapTx();
  }, [address, fetchState, isSubmittingTap, isTxMined, pendingTaps]);

  const handleTap = () => {
    if (!state || !address || !isCorrectChain || isBusy) return;
    setPendingTaps((prev) => prev + 1);
  };

  const handleSyncTaps = async () => {
    if (!address || !isCorrectChain || pendingTaps <= 0) return;
    setError("");
    try {
      setIsSubmittingTap(true);
      const data = withRoboTapperBuilderCodeDataSuffix(
        encodeFunctionData({
          abi: roboTapperOnchainAbi,
          functionName: "tap",
          args: [BigInt(pendingTaps)],
        })
      );
      await sendTransactionAsync({
        to: contractAddress,
        data,
        value: BigInt(0),
        chainId: base.id,
      });
    } catch (err) {
      setIsSubmittingTap(false);
      setError(err instanceof Error ? err.message : "Не удалось отправить onchain транзакцию для тапов.");
    }
  };

  const handleCheckin = async () => {
    if (!address || !state?.canCheckinNow) return;
    setError("");
    try {
      setIsSubmittingCheckin(true);
      const data = withRoboTapperBuilderCodeDataSuffix(
        encodeFunctionData({
          abi: roboTapperOnchainAbi,
          functionName: "checkIn",
        })
      );
      await sendTransactionAsync({
        to: contractAddress,
        data,
        value: parseEther(ROBO_TAPPER_CHECKIN_PRICE_ETH),
        chainId: base.id,
      });
    } catch (err) {
      setIsSubmittingCheckin(false);
      setError(err instanceof Error ? err.message : "Не удалось отправить ончейн check-in транзакцию.");
    }
  };

  const isBusy = isWritePending || isTxMining || isSubmittingCheckin || isSubmittingTap;
  const isCorrectChain = chainId === base.id;
  const multiplier = state ? state.multiplier : 1;
  const projectedScore = Number(((state?.score ?? 0) + pendingTaps * multiplier).toFixed(2));

  return (
    <main className={styles.container}>
      <div className={styles.sunsetLayer} />
      <div className={styles.cityLayer} />
      <div className={styles.gridLayer} />

      <section className={styles.card}>
        <h1 className={styles.title}>ROBO TAPPER</h1>
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
            <p className={styles.metaValue}>{projectedScore.toFixed(2)}</p>
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
            <p className={styles.hint}>Неотправленных тапов: {pendingTaps}</p>
            <button
              className={styles.neonButton}
              type="button"
              onClick={() => void handleSyncTaps()}
              disabled={pendingTaps <= 0 || !isCorrectChain || isBusy}
            >
              {isSubmittingTap || isWritePending || isTxMining ? "Транзакция..." : `Отправить ${pendingTaps} тап(ов) onchain`}
            </button>
          </div>
        )}

        {view === "checkin" && (
          <div className={styles.viewBlock}>
            <p className={styles.checkinText}>
              Следующее окно check-in: <strong>каждые 2 минуты</strong>
            </p>
            <p className={styles.hint}>Стоимость check-in: {ROBO_TAPPER_CHECKIN_PRICE_ETH} ETH</p>
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
                  : "Чек-ин уже сделан в этом окне"}
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
