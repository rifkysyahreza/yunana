# Token Screener Bot (Solana -> GMGN -> Meteora -> Telegram)

Monitors Solana chain activity from now forward, extracts candidate token mints from watched addresses, filters by GMGN fee/market-cap ratio, then checks Meteora DLMM pool and sends Telegram alerts.

## Flow

1. Poll Solana via Helius RPC every 15 seconds.
2. Scan only fresh signatures (present -> future, no historical backfill).
3. Extract token mints from transaction token balances and bonding/migration signals.
4. Fetch GMGN token info and apply ratio (only when `FORWARD_ALL_MIGRATED=false`):
   `sol_per_10k_mc = (total_fee * 10000) / market_cap`
   Keep token if `MIN_SOL_PER_10K_MC <= sol_per_10k_mc <= MAX_SOL_PER_10K_MC`.
5. Search Meteora DLMM pool.
6. Send Telegram message.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill values:

- `HELIUS_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `WATCH_ADDRESSES` (comma-separated Solana addresses to monitor)
- Optional: `WATCH_PROGRAM_IDS` (comma-separated program IDs for stronger bonding/migration filtering)
- Optional: `SCAN_INTERVAL_MS` (default `15000`)
- Optional: `MIN_MC_PER_SOL_FEE` (default `10000`)
- Optional: `FORWARD_ALL_MIGRATED` (default `false`)
- Optional: `MIN_SOL_PER_10K_MC` (default `0.8`)
- Optional: `MAX_SOL_PER_10K_MC` (default `1`)
- Optional: `GMGN_RETRY_COUNT` (default `5`)
- Optional: `GMGN_RETRY_DELAY_MS` (default `2500`)
- Optional: `GMGN_QUOTE_WALLET` (wallet id used in GMGN quotation endpoint path)

3. Run:

```bash
npm run dev
```

## Notes

- This scanner is chain-first (Helius RPC) and does not rely on timeline APIs.
- Picking good `WATCH_ADDRESSES` is critical. Use migration/bonding-related addresses/programs you trust.
- Migration detection is currently migration-only (`migrate` signal in logs/instructions).
- If `WATCH_PROGRAM_IDS` is set, only transactions with matching program/account hints are processed.
- Tokens with `launchpad_platform = pump_mayhem` are ignored.
