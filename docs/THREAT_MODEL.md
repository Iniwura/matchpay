# MatchPay threat model

## Untrusted inputs

Buyer criteria, supplier document URLs, document identifiers, rendered document contents, model output, and transaction callers are all untrusted. The contract bounds lengths and counts, rejects duplicate JSON keys, canonicalizes the committed source set, and treats rendered content as data.

## Semantic attack surface

The prompt explicitly isolates document contents from instructions and forbids following URLs introduced by documents. The model returns criterion facts only. Exact-key schema validation rejects extra control fields such as `outcome` or `payout`; the contract derives the outcome locally. Validator disagreement fails closed to `UNRESOLVED`.

## Escrow attack surface

Funding is exact and buyer-gated. The supplier cannot choose a verdict or payment. Payment is supplier-gated, exact, one-shot, and state-before-transfer. Refund is buyer-gated and unavailable for `MATCHED`; unresolved refunds require repair exhaustion.

## Known evidence boundary

HTTPS and SHA-256 commitments do not prove that a URL is controlled by a named party, that a source existed before funding, or that the public source will remain unchanged. For high-assurance production use, parties should commit hashes from a separately governed document archive and preserve the rendered fixture used in the live proof.
