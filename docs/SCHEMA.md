# MatchPay schema notes

The eight required criterion IDs are fixed and ordered:

`order_identity`, `supplier_binding`, `goods_scope`, `quantity`, `substitutions`, `invoice_terms`, `delivery_scope`, `acceptance_conditions`.

Each semantic criterion result has exactly:

```json
{
  "criterion_id": "quantity",
  "status": "SATISFIED | VIOLATED | UNRESOLVED",
  "witness_evidence_ids": ["po", "invoice", "receipt"],
  "observed_fact": "concise audit metadata"
}
```

The deployed schema should be generated from `contracts/match_pay.py` and treated as the authoritative ABI. Frontends must pass structured fields as canonical JSON strings and must read `latest-nonfinal` state after writes.
