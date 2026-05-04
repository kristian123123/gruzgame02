# Robo Tapper

Cyberpunk mini game for Base App:
- tap the robot to gain score,
- perform one onchain check-in per day,
- increase tap multiplier by +10% per check-in streak,
- compete in leaderboard.

## Features

- Menu with 3 actions:
  - `Лидерборд`
  - `Ончейн чек-ин`
  - `Начать тапать`
- Tap gameplay:
  - base tap value: `1`,
  - multiplier: `1 + streak * 0.1`.
- Onchain check-in:
  - one check-in per 10-minute window,
  - streak grows only with consecutive windows,
  - streak resets after missing a window.
- Countdown to next 10-minute check-in window.
- Unique checked-in users counter.

## Stack

- Next.js App Router
- wagmi + viem
- Base Mini App SDK

## Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_URL=http://localhost:3000
```

## Run

```bash
npm install
npm run dev
```
