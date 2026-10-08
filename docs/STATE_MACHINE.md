# MatchPay state machine

```text
DRAFT --fund_order(exact value)--> FUNDED --activate_order--> OPEN
OPEN --submit_packet--> SUBMITTED
SUBMITTED --adjudicate_order--> MATCHED --settle_match--> PAID
SUBMITTED --adjudicate_order--> MISMATCHED --refund_order--> REFUNDED
SUBMITTED --adjudicate_order--> UNRESOLVED
UNRESOLVED --repair_packet(within frozen budget)--> SUBMITTED
UNRESOLVED --refund_order(after budget exhausted)--> REFUNDED
```

`DRAFT`, `FUNDED`, and `OPEN` contain no supplier packet. A packet revision is immutable after submission; adjudication adds protocol metadata to the packet record but never edits its invoice, receipt, or document-identifier fields. A repair appends a new packet record with a `prior_packet_id` link.

The protocol deliberately uses a deterministic repair budget instead of an on-chain timestamp. GenVM timestamp availability is not a reliable settlement primitive. A buyer cannot refund an unresolved order until all frozen repair opportunities are consumed, and no unresolved order can ever be paid.
