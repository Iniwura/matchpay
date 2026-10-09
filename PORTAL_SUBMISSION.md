# MatchPay Portal Submission Packet

## Reviewer walkthrough

1. Open the read-only reviewer experience first:
   https://matchpay-psi.vercel.app/proof
2. Inspect `live-match`: compatible paperwork, `MATCH`, and exact supplier
   payment of `0.01 GEN`.
3. Inspect `live-mismatch`: material substitution, supplier blocked, and exact
   buyer refund of `0.01 GEN`.
4. Inspect `live-unresolved`: unavailable evidence, fail-closed
   `UNRESOLVED`, and exact buyer refund after the repair budget is exhausted.
5. Open one deeper case dossier, for example:
   https://matchpay-psi.vercel.app/app/orders/live-match
6. Use the explorer links only as supporting evidence. The proof page and
   dossier are understandable without connecting a wallet; wallet connection
   is only needed for buyer/supplier writes in the settlement desk.
7. Confirm the final states are respectively `PAID`, `REFUNDED`, and
   `REFUNDED`, with packet outcomes `MATCHED`, `MISMATCHED`, and `UNRESOLVED`.
8. Follow the exact transaction hashes, receipts, transfer evidence, replay
   guards, and authoritative post-write reads in
   [`docs/RELEASE_RECORD.md`](docs/RELEASE_RECORD.md).

The production frontend is wired to:

- Contract: `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`
- Deployment transaction: `0xe4a4105113222673fcb774b74293235b83ee3a6398832b65a5ea9229fb9abd87`
- Chain: GenLayer Studio Dev (`61997`)

## Submission facts

- Public repository: https://github.com/Iniwura/matchpay
- Contract source commit: `9a5b13c`
- Previous public release commit before this cleanup:
  `121b21e921851b9a5cfd779e56307f2929721be2`
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
- Legacy frontend cleanup: unused `frontend/src/main.tsx` and
  `frontend/src/styles.css` removed; the production asset names and bundle
  contract address remained unchanged.

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
