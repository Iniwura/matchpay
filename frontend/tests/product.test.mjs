import test from "node:test";
import assert from "node:assert/strict";
import { isActionable, label, parseJson, statusDescription } from "../dist-test/product.js";

test("labels preserve the commercial vocabulary", () => assert.equal(label("delivery_scope"), "Delivery Scope"));
test("malformed chain JSON has a safe fallback", () => assert.deepEqual(parseJson("not-json", []), []));
test("matched state only enables supplier settlement", () => {
  const order = { state: "MATCHED", buyer: "0xbuyer", supplier: "0xsupplier", max_repairs: 0, current_packet: { revision: 1 } };
  assert.equal(isActionable(order, "0xsupplier", "settle"), true);
  assert.equal(isActionable(order, "0xbuyer", "refund"), false);
  assert.match(statusDescription("MATCHED"), /exact escrow/i);
});
