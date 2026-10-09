# MatchPay Portal Submission Packet

## Reviewer walkthrough

1. Open the production frontend: https://matchpay-psi.vercel.app
2. Connect a GenLayer Studio Dev wallet on chain `61997`.
3. Use the order lookup to inspect the three completed proof orders:
   `live-match`, `live-mismatch`, and `live-unresolved`.
4. Confirm the final states are respectively `PAID`, `REFUNDED`, and
   `REFUNDED`, with packet outcomes `MATCHED`, `MISMATCHED`, and `UNRESOLVED`.
5. Follow the exact transaction hashes, receipts, transfer evidence, replay
   guards, and authoritative post-write reads in
   [`docs/RELEASE_RECORD.md`](docs/RELEASE_RECORD.md).

The production frontend is wired to:

- Contract: `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`
- Deployment transaction: `0xe4a4105113222673fcb774b74293235b83ee3a6398832b65a5ea9229fb9abd87`
- Chain: GenLayer Studio Dev (`61997`)

## Submission facts

- Public repository: https://github.com/Iniwura/matchpay
- Contract source commit: `9a5b13c`
- Previous public release commit before the frontend redesign:
  `44bd5985f373d593907d8dead16dc9fa97b4ed23`
- Final frontend release commit: the editorial redesign commit now at `main`;
  the exact new HEAD is reported with this packet.
- Local/deployed source SHA-256:
  `99df9bcc6fcd09718a6354664b70de35b2c133c1711173db2776c2048cf5fe55`
- Checked-in schema SHA-256:
  `9884f67f3c6b565222973251ec319728b0ca3a3006f7220a372cce2b4deaae35`
- Deployment lifecycle: `FINALIZED`, `MAJORITY_AGREE`, accepted
- Vercel deployment: `READY`, production target
- Vercel deployment ID: `dpl_9dstBFCEmj8sBUwy2TZvuQyv7EJo`
- Vercel SSO/deployment protection: disabled for anonymous public access

The production route matrix is covered by the SPA fallback: `/`, `/proof`,
`/app`, `/app/create`, and `/app/orders/live-match` each return HTTP 200.

## Verification gates

- Python tests: `16 passed`
- GenVM lint: passed
- GenVM validate: passed; 12 methods, 4 views, 8 writes
- GenVM typecheck: passed with zero diagnostics
- Frontend tests: `3 passed`
- Frontend typecheck: passed
- Frontend production build: passed

For the full evidence table and exact hashes, use
[`docs/RELEASE_RECORD.md`](docs/RELEASE_RECORD.md). No replay transaction was
submitted: the fee-aware simulations rejected the already-settled/refunded
calls before signing, and the unchanged authoritative reads are recorded there.
