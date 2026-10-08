# MatchPay live-proof fixtures

These small static documents are intentionally plain text so the Studio Dev `web.render` path can fetch them without a browser or a third-party dependency.

- `po-match.txt`, `invoice-match.txt`, and `receipt-match.txt` form the exact-match case.
- `po-mismatch.txt`, `invoice-mismatch.txt`, and `receipt-mismatch.txt` form a material-mismatch case, with an invoice quantity and total that disagree with the frozen purchase order.
- The unresolved case uses a non-existent sibling URL in the public repository and a content commitment that cannot match; MatchPay records `UNRESOLVED` before semantic payment logic.
