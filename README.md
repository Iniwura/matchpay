# MatchPay

MatchPay is a funded three-document commercial settlement protocol for GenLayer:

`PURCHASE ORDER + INVOICE + DELIVERY / RECEIPT → semantic reconciliation → deterministic native-GEN settlement`

The contract freezes the buyer's order definition before funding, stores supplier packets as immutable revisions, and uses GenLayer only to produce bounded criterion facts. The contract derives the settlement outcome from those facts:

- any `VIOLATED` required criterion → `MISMATCHED`;
- otherwise any `UNRESOLVED` criterion → `UNRESOLVED`;
- only all `SATISFIED` → `MATCHED`.

Model prose never chooses a payout amount, recipient, or settlement state.

## Contract surface

Writes:

- `create_order(...)`
- payable `fund_order(order_id)`
- `activate_order(order_id)`
- `submit_packet(order_id, invoice_manifest_json, delivery_manifest_json, document_identifiers_json)`
- `repair_packet(...)` — creates a new immutable revision only while the frozen repair budget remains
- `adjudicate_order(order_id)` — independently fetches the frozen source set in leader and validator paths
- `settle_match(order_id)` — supplier-only, exact escrow, once
- `refund_order(order_id)` — buyer-only for `MISMATCHED`, or `UNRESOLVED` after the frozen repair budget is exhausted

Views:

- `get_order(order_id)`
- `get_packet(packet_id)`
- `get_order_ids()`
- `get_order_fingerprint(order_id)`

## Evidence integrity boundary

Each document definition is a canonical HTTPS URL plus an optional SHA-256 content commitment. The commitment proves only that the content rendered during adjudication had that digest. It does not prove URL ownership, historical availability, or publisher authenticity. Source contents are treated as untrusted data and cannot redefine the prompt schema or settlement law.

## Local verification

Use the pinned Studio Dev environment:

```bash
python -m pytest -q
GENVMROOT=/tmp/matchpay-genvmroot GENVM_VERSION=vstudio-dev /home/ini/groundshift/.venv/bin/genvm-lint check contracts/match_pay.py
GENVMROOT=/tmp/matchpay-genvmroot GENVM_VERSION=vstudio-dev /home/ini/groundshift/.venv/bin/genvm-lint validate --json contracts/match_pay.py
GENVMROOT=/tmp/matchpay-genvmroot GENVM_VERSION=vstudio-dev /home/ini/groundshift/.venv/bin/genvm-lint schema --json contracts/match_pay.py
PATH="/home/ini/groundshift/.venv/bin:$PATH" GENVM_VERSION=vstudio-dev /home/ini/groundshift/.venv/bin/genvm-lint typecheck contracts/match_pay.py --json
```

The Direct Mode suite covers exact matches, material substitutions, wrong-order receipts, missing evidence, hash mismatch, frozen criteria, immutable revisions, malformed output, validator disagreement, prompt injection, repair exhaustion, exact payout once, and refund exclusivity.

## Chain-backed portal

The frontend is a read-through to the deployed contract; it never seeds demo orders or invents settlement state.

```bash
cd frontend
cp .env.example .env
# set VITE_MATCHPAY_CONTRACT_ADDRESS to the deployed MatchPay address
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The portal uses GenLayer JS `2.0.0-rc.1`, Studio Dev chain `61997`, latest-nonfinal reads, exact payable funding, and explicit wallet actions for buyer and supplier roles.

## Public live-proof fixtures

Static source documents for the live proof are under `evidence/fixtures/`. After publishing this repository, use the raw GitHub URLs for the exact-match and material-mismatch cases. The unresolved proof intentionally uses a missing fixture URL plus a non-matching content commitment, exercising MatchPay's fail-closed unavailable-source path.

## State machine

See `docs/STATE_MACHINE.md`, `docs/THREAT_MODEL.md`, and `docs/SCHEMA.md`. Live proof is intentionally separate from Direct Mode and must use a fresh Studio Dev deployment with stable public fixtures.
