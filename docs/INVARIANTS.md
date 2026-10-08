# Settlement invariants

1. The order fingerprint commits buyer, supplier, amount, purchase-order sources, all eight criterion definitions, invoice requirements, delivery requirements, deadline text, and repair budget.
2. Funding succeeds only when the caller is the stored buyer and `gl.message.value` equals the frozen amount exactly.
3. No public method accepts a semantic verdict, payout amount, or recipient from the supplier.
4. The semantic result must contain exactly one bounded result for every frozen criterion. A violated criterion must name at least one committed source witness.
5. Final outcome is derived deterministically from criterion statuses; reasoning is audit metadata only.
6. Leader and validator independently fetch the same frozen source set. Validator disagreement or malformed output becomes `UNRESOLVED` and cannot pay.
7. `MATCHED` pays exactly the frozen amount to the stored supplier, changes state to `PAID` before transfer, and cannot be refunded or paid again.
8. `MISMATCHED` can only be refunded to the stored buyer.
9. `UNRESOLVED` can only be repaired within the stored limit and can only be refunded after that limit is exhausted.
10. URL validation is canonical HTTPS validation. An optional SHA-256 proves only content equality at adjudication, not URL authenticity or historical immutability.
