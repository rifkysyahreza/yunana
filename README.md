# Token Screener Bot (Solana -> GMGN -> Meteora -> Telegram)

Monitors Solana chain activity from now forward, extracts candidate token mints from watched addresses, filters by GMGN fee/market-cap ratio, then checks Meteora DLMM pool and sends Telegram alerts.

## Flow

1. Poll Solana via Helius RPC every 15 seconds.
2. Scan only fresh signatures (present -> future, no historical backfill).
3. Extract token mints from transaction token balances and bonding/migration signals.
4. Fetch GMGN token info and apply ratio: `market_cap / total_fee >= MIN_MC_PER_SOL_FEE`.
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

3. Run:

```bash
npm run dev
```

## Notes

- This scanner is chain-first (Helius RPC) and does not rely on timeline APIs.
- Picking good `WATCH_ADDRESSES` is critical. Use migration/bonding-related addresses/programs you trust.
- If `WATCH_PROGRAM_IDS` is set, only transactions with matching bonding logs/program hints are processed.

