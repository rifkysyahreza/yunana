# Token Screener Bot (Solana -> GMGN -> Meteora -> Telegram)

Monitors Solana chain activity from now forward, extracts candidate token mints from watched addresses, filters by GMGN fee/market-cap ratio plus top-holder scalp-risk signals, then checks Meteora DLMM pool and sends Telegram alerts.

## Flow

1. Poll Solana via Helius RPC every 15 seconds.
2. Scan only fresh signatures (present -> future, no historical backfill).
3. Extract token mints from transaction token balances and bonding/migration signals.
4. Fetch GMGN token info and apply ratio (only when `FORWARD_ALL_MIGRATED=false`):
   `sol_per_10k_mc = (total_fee * 10000) / market_cap`
   Keep token if `MIN_SOL_PER_10K_MC <= sol_per_10k_mc <= MAX_SOL_PER_10K_MC`.
5. Volume gate: 1m candles at migrated minute + next closed minute.
   Keep token if `(candle_0_volume + candle_1_volume) / 2 >= MIN_TWO_CANDLE_AVG_VOLUME`.
5. Search Meteora DLMM pool.
6. Send Telegram message.
7. Optional: track labeled Solana wallets and alert when they open a new Meteora DLMM position.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill values:

- `HELIUS_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- Optional: `TELEGRAM_ALLOWED_USER_ID` (only accept Telegram bot commands from this sender id)
- Optional: `TELEGRAM_MIGRATION_THREAD_ID` (Telegram forum topic id for migration alerts)
- Optional: `TELEGRAM_TRENDING_THREAD_ID` (Telegram forum topic id for GMGN trending alerts)
- Optional: `TELEGRAM_LP_WALLET_THREAD_ID` (Telegram forum topic id for LP wallet tracker alerts)
- Optional: `TELEGRAM_NEW_DLMM_POOL_THREAD_ID` (Telegram forum topic id for new DLMM pool alerts)
- Optional: `TELEGRAM_WALLET_ACTIVITY_THREAD_ID` (Telegram forum topic id for temporary raw wallet-activity alerts, default `4184`)
- Optional: `ENABLE_NEW_DLMM_POOL_TRACKER` (monitor new Meteora DLMM pools from `initialize_lb_pair2`)
- Optional: `NEW_DLMM_POOL_MIN_VOLUME` (minimum 5m volume needed before a new DLMM pool alert is sent)
- Optional: `NEW_DLMM_POOL_TIER1_INTERVAL_MS` (poll interval for Tier 1 preset addresses)
- Optional: `NEW_DLMM_POOL_TIER2_INTERVAL_MS` (poll interval for Tier 2 preset addresses)
- `WATCH_ADDRESSES` (comma-separated Solana addresses to monitor)
- Optional: `WATCH_PROGRAM_IDS` (comma-separated program IDs for stronger bonding/migration filtering)
- Optional: `SCAN_INTERVAL_MS` (default `15000`)
- Optional: `ENABLE_LP_WALLET_TRACKER` (default `false`)
- Optional: `LP_WALLET_TRACKER_INTERVAL_MS` (default `60000`)
- Optional: `LP_WALLET_ENRICHMENT_RETRY_COUNT` (default `3`)
- Optional: `LP_WALLET_ENRICHMENT_RETRY_DELAY_MS` (default `5000`)
- Optional: `LP_WALLET_SHARD_COUNT` (default `1`, splits tracked wallets across LP tracker ticks)
- Optional: `METEORA_POOL_META_CACHE_TTL_MS` (default `3600000`, cache TTL for pool pair/bin metadata)
- Optional: `LP_TRACKED_WALLETS_FILE` (default `./tracked-lp-wallets.json`)
- Optional legacy fallback: `LP_TRACKED_WALLETS` (comma-separated `label:wallet` entries for DLMM wallet-open alerts)
- Optional temporary raw wallet-activity tracker: `ENABLE_WALLET_ACTIVITY_TRACKER`, `WALLET_ACTIVITY_TRACKER_INTERVAL_MS`, `WALLET_ACTIVITY_TRACKED_WALLETS_FILE` (default `./tracked-wallet-activity-wallets.json`), or legacy fallback `WALLET_ACTIVITY_TRACKED_WALLETS`
- Optional: `FORWARD_ALL_MIGRATED` (default `false`)
- Optional: `MIN_SOL_PER_10K_MC` (default `0.8`)
- Optional: `MAX_SOL_PER_10K_MC` (default `1`)
- Optional top-holder scalp-risk knobs: `TOP_HOLDER_ANALYSIS_COUNT`, `TOP_HOLDER_FUNDING_YOUNG_MAX_AGE_HOURS`, `TOP_HOLDER_EQUAL_BALANCE_MIN_REPEAT_RATE`, `TOP_HOLDER_EQUAL_SUPPLY_MIN_REPEAT_RATE`, `TOP_HOLDER_SUPPLY_UNIFORMITY_MAX_CV`
- Optional: `MIN_TWO_CANDLE_AVG_VOLUME` (default `18000`)
- Optional: `PIPELINE_SUMMARY_EVERY_TICKS` (default `20`, set `0` to disable)
- Optional: `GMGN_RETRY_COUNT` (default `5`)
- Optional: `GMGN_RETRY_DELAY_MS` (default `2500`)
- Optional: `ENABLE_GMGN_TRENDING` (default `false`, enables Phase 3 skeleton poller)
- Optional: `GMGN_TRENDING_INTERVAL_MS` (default `60000`)
- Optional: `GMGN_QUOTE_WALLET` (wallet id used in GMGN quotation endpoint path)

3. Run:

```bash
npm run dev
```

## Notes

- This scanner is chain-first (Helius RPC) and does not rely on timeline APIs.
- Picking good `WATCH_ADDRESSES` is critical. Use migration/bonding-related addresses/programs you trust.
- Migration detection is currently migration-only (`migrate` signal in logs/instructions).
- BONK.fun Raydium LaunchLab migrations are extracted directly from the migration instruction mint account, which avoids false candidates from LP/NFT mints in the same tx.
- Meteora Curve migrations are also extracted directly from the migration instruction mint account, which avoids mixing in the Meteora position NFT mint from the same tx.
- Alerts use explicit titles: `Token Migration` for migration alerts and `GMGN Trending` for the separate trending engine.
- Migration scoring now also checks short-term scalpability signals from top holders, using GMGN top-holder stats for funding source, funding amount, wallet age, tags, repeated balance patterns, overly even supply splits, and weak fee-to-market-cap ratio.
- Optional LP wallet tracker: poll labeled Solana wallets and alert when a tracked wallet opens a new Meteora DLMM position.
- Optional temporary wallet activity tracker: poll labeled Solana wallets and alert every newly seen transaction signature for those wallets.
- Preferred wallet input is a JSON file like `tracked-lp-wallets.json` (see `tracked-lp-wallets.example.json`); `.env` wallet list is kept as a legacy fallback.
- Temporary wallet activity tracker also supports a JSON file like `tracked-wallet-activity-wallets.json` (see `tracked-wallet-activity-wallets.example.json`).
- The JSON file supports both a simple array format and a richer schema with `version`, `defaults`, and `wallets` entries (plus optional `group`, `priority`, and `notes` per wallet).
- LP wallet tracker alert format now aims to show compact pool context like `Pool: TOKEN / SOL (100/2%)` and a range like `83.3609 ~ 83.9297 (0.68%)` when enrichment data is available.
- If you run the bot inside a Telegram supergroup with forum topics enabled, you can route migration, trending, LP wallet tracker, new DLMM pool alerts, and temporary wallet activity alerts to different topics by setting `TELEGRAM_MIGRATION_THREAD_ID`, `TELEGRAM_TRENDING_THREAD_ID`, `TELEGRAM_LP_WALLET_THREAD_ID`, `TELEGRAM_NEW_DLMM_POOL_THREAD_ID`, and `TELEGRAM_WALLET_ACTIVITY_THREAD_ID`.
- Migration alerts also surface source context (for example Pump.fun, BONK.fun, or Meteora Curve) using GMGN launchpad metadata when available.
- Phase 3 adds a separate GMGN trending poller path; it is intentionally isolated from the migration scanner so the two engines do not get mixed together.
- If `WATCH_PROGRAM_IDS` is set, only transactions with matching program/account hints are processed.
- Tokens with `launchpad_platform = pump_mayhem` are ignored.
- Hard security gate: token is ignored unless `renounced_mint=true` and `renounced_freeze_account=true`.
- Pipeline logs now include stage + reason code, for example:
  `[skip] <mint> stage=ratio reason=sol_per_10k_mc_out_of_range`
