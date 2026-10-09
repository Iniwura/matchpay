# MatchPay release record

Recorded 2026-10-09 (Africa/Lagos) from authoritative Studio Dev reads.

## Public release

- GitHub: https://github.com/Iniwura/matchpay
- Release source commit: `9a5b13c` (`Compare payment statuses across validators`)
- Frontend contract configuration: `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`

## Contract deployment

- Network: GenLayer Studio Dev
- Chain ID: `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Deployer: `recall-deployer` (`0x01feebafdfddd4ba23f69b43f0b501bba7aa7cff`)
- Deployment transaction: `0xe4a4105113222673fcb774b74293235b83ee3a6398832b65a5ea9229fb9abd87`
- Contract address: `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`
- Deployment receipt: `FINALIZED`, `MAJORITY_AGREE`, lifecycle `accepted`
- Local source SHA-256: `99df9bcc6fcd09718a6354664b70de35b2c133c1711173db2776c2048cf5fe55`
- Deployed source SHA-256: `99df9bcc6fcd09718a6354664b70de35b2c133c1711173db2776c2048cf5fe55`
- Source comparison: byte-for-byte match

The checked-in schema is `evidence/schema.json`, SHA-256
`9884f67f3c6b565222973251ec319728b0ca3a3006f7220a372cce2b4deaae35`.
The authoritative deployed schema has 12 methods: `activate_order`,
`adjudicate_order`, `create_order`, `fund_order`, `get_order`,
`get_order_fingerprint`, `get_order_ids`, `get_packet`, `refund_order`,
`repair_packet`, `settle_match`, and `submit_packet`. `fund_order` is the
only payable method.

## Evidence commitments

The disposable Studio render probe finalized accepted at
`0xD31e31b6EE82fDfFB4c46f905f52535f148DbB69`; deployment transaction:
`0xbfbe22c38bdcb650c98c0cbd1613219243080eebeb664180373f0e3f63643d82`.
Its authoritative rendered hashes matched the committed fixture hashes:

| Fixture | SHA-256 |
| --- | --- |
| `po-match.txt` | `7b691e7e048225e4d503fc6fc8e9488b228ceed828a8780e5a53c8e2956fe235` |
| `invoice-match.txt` | `d6d52e7c55fcf7a90c8409a0fe2c78b9f0d3cff00454a0bef49e5b7f552205d3` |
| `receipt-match.txt` | `c0bf318560e2e2c1c2480dfcd7116d4e935d967685ed33ad8f031df5993dfc79` |
| `po-mismatch.txt` | `b190584962145e66dd6ac3a9f34b981b9ee945f80ed25c21ee50b6e87aa4dda6` |
| `invoice-mismatch.txt` | `05670500ee7f3937006514b9d84e8e94b952e13ac9ea981a1ba9ca37ac289b23` |
| `receipt-mismatch.txt` | `635ccdc43ad9f9d7acbfef35cffeabff3960881ab8ca88aea8dffea088b453b3` |

## Finalized live proof

Every transaction in this table finalized with `FINISHED_WITH_RETURN`,
`MAJORITY_AGREE`, and lifecycle `accepted`. Amounts are exact wei.

| Case | Operation | Transaction | Authoritative resulting state |
| --- | --- | --- | --- |
| `live-match` | create | `0xfc36ff342b4aff34efc079c7e8ab6e3e2578377a31b05088fd73d49d7abaf8ee` | `DRAFT` |
|  | fund `0.01 GEN` | `0x48381ef5ff19b294b89f61ae134e5f43393afd1688dd464d1ef60886b59418be` | `FUNDED` |
|  | activate | `0xf90432bfe6a639cbbc5bc29d8c1a2b7f81440f2053fd303b2a953b08b88993dd` | `OPEN` |
|  | submit packet | `0x9cd96c394b31cef0eee4211a0c33eccfa488da137e4d310a3bd57223012ac8b7` | `SUBMITTED` |
|  | adjudicate | `0xddb977d768115014b1197ff9a662f574e91392be47519a9350a5d26c8ab62944` | `MATCHED` |
|  | settle exact supplier payout | `0x84a27d16ebc88be577c9826472cb9c6c0a820ab89ca965a4e971783619fbfadd` | `PAID`, supplier receipt `10000000000000000` |
| `live-mismatch` | create | `0x7951d2d420422418329ca382a249b3f2bb6e9b11e5c9dde3e4b0a94255b7621c` | `DRAFT` |
|  | fund `0.01 GEN` | `0xd67c8b970c4ba4333d2926404c369275b44e9c4576993612e59bf8377f01efed` | `FUNDED` |
|  | activate | `0x287fe9a79223c5c562253dfbc404bdb4e124795397132a4a18bce99b4b841692` | `OPEN` |
|  | submit packet | `0xc4f72c0e90cf8f25101b8ae2b751a83379bb67ab3f05f2ff539a13cd606ba197` | `SUBMITTED` |
|  | adjudicate | `0x6bc06b32db48292bf45ccaf7a7b46ad360d79802ea468a4ef550304bd3c14cbe` | `MISMATCHED` |
|  | refund exact buyer escrow | `0x3a7aa972ab781b1daba201700b2633bb5c881ea67e929712cf0964d8f80bb2e6` | `REFUNDED`, buyer receipt `10000000000000000` |
| `live-unresolved` | create | `0x47ac43026f6336d635b1c2ad6c3cad0ac04a851d4a54afe652777874427398d3` | `DRAFT` |
|  | fund `0.01 GEN` | `0xd1e6d9bf4c5a83e69f9b8b15dc478e2f73213a0cf31b162663363e7fca118bb8` | `FUNDED` |
|  | activate | `0x4b30e8b073f6bef0d9473130c0543e66401d8de5e1086c5dd61453df18c28886` | `OPEN` |
|  | submit packet | `0x71f810efcb5b1131a07a1f30e06cd0cc0f79e604c7661c7d7c91273e23062019` | `SUBMITTED` |
|  | adjudicate unavailable committed source | `0xa24b05fd14c8c05170a61f2cc89530c83b4fbb391dedd4a27c264d7ed8f4f7c0` | `UNRESOLVED` |
|  | refund after exhausted repair budget | `0x5517b896d88e08b35a41fcfed5bea2f9418e2cbed0b19d59c08bbed28236ee05` | `REFUNDED`, buyer receipt `10000000000000000` |

The payout and both refunds emitted authoritative external native-transfer
messages for exactly `10000000000000000` wei to the stored recipient. The
settlement receipt names the supplier `0xa35dc047f9937bf668743efbdf8ea93b31a55888`;
both refund receipts name the buyer
`0x01feebafdfddd4ba23f69b43f0b501bba7aa7cff`.

## Replay protection

After `live-match` became `PAID`, a second `settle_match` fee-aware simulation
was rejected and no transaction was submitted. The authoritative order read
remained `PAID` with the same supplier receipt. After each refund, a second
`refund_order` simulation was rejected and no transaction was submitted; both
orders remained `REFUNDED` with the same buyer receipt. This is recorded as a
zero-second-transfer proof: no replay transaction hash exists because the
guard rejected the call before signing/submission.

## Frontend verification

- Contract address is configured in `frontend/.env.production` and
  `frontend/.env.example`.
- Production bundle embeds `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`.
- `npm test`: 3 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite emitted only the known large GenLayer client
  chunk warning.
- Reads use the SDK `LATEST_NONFINAL` path for responsive authoritative chain
  reads; writes estimate fees, preserve payable `fund_order` value, wait for a
  decided receipt, and refresh order state from chain.

## Vercel production

- Project: `matchpay` under `iniwura-akurus-projects`
- Production URL: https://matchpay-psi.vercel.app
- Deployment ID: `dpl_9dstBFCEmj8sBUwy2TZvuQyv7EJo`
- Deployment status: `READY`, target `production`
- Inspector: https://vercel.com/iniwura-akurus-projects/matchpay/9dstBFCEmj8sBUwy2TZvuQyv7EJo
- Route verification: anonymous HTTP requests to `/`, `/proof`, `/app`,
  `/app/create`, and `/app/orders/live-match` each returned `200` after the
  SPA fallback was added in `frontend/vercel.json`.
- Vercel SSO/deployment protection: disabled for anonymous public access.
- Anonymous browser verification: fresh Chromium profiles received HTTP 200,
  loaded the MatchPay landing page, proof page, settlement desk, live dossier,
  and creation flow. The proof page showed all three reviewer orders
  (`live-match`, `live-mismatch`, `live-unresolved`) with `PAID` and `REFUNDED`
  outcomes, and showed no login, authentication, or deployment-protection wall.
  The profiles had zero cookies and no local-storage entries; mobile routes had
  no horizontal overflow.
- The anonymous browser loaded the production JavaScript asset
  `/assets/index-CvoyQbee.js`; the asset contains the deployed contract address
  `0x2329e3DcF5C82b525505036Ef0bC1217982e6367`.
