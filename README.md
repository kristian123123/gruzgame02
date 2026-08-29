# Robo Tapper
я
Cyberpunk mini game for Base App:
- tap the robot to gain score,
- perform one onchain check-in per 2-minute window,
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
  - one check-in per 2-minute window,
  - check-in price: `0.00001 ETH`,
  - streak grows only with consecutive windows,
  - streak resets after missing a window.
- Countdown to next 2-minute check-in window.
- Unique checked-in users counter.

## Stack

- Next.js App Router
- wagmi + viem
- Base Mini App SDK
- Solidity contract (source in `contracts/RoboTapperOnchain.sol`)

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

## Onchain check-in contract

App now sends real contract calls (`tap`, `checkIn`) so BaseScan shows interaction with your app contract.
Transactions append the Base Builder Code suffix for `bc_vnh64v7g`:
`0x62635f766e6836347637670b0080218021802180218021802180218021`.

Deployed Base Mainnet contract:
`0x70B9c94BCc1B1B0CCA6B94948C3A8AF6fA20269c`.

1. Open `contracts/RoboTapperOnchain.sol` in Remix.
2. Deploy to Base Mainnet (or Base Sepolia for testing).
3. Copy deployed address.
4. Update `ROBO_TAPPER_CONTRACT_ADDRESS` in `lib/contracts/roboTapperOnchain.ts`.
5. Redeploy.
