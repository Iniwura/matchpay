export const CRITERIA = [
  ["order_identity", "Order identity"],
  ["supplier_binding", "Supplier binding"],
  ["goods_scope", "Goods / service scope"],
  ["quantity", "Quantity"],
  ["substitutions", "Substitutions"],
  ["invoice_terms", "Invoice terms"],
  ["delivery_scope", "Delivery / receipt scope"],
  ["acceptance_conditions", "Acceptance conditions"],
] as const;
export type Status = "DRAFT" | "FUNDED" | "OPEN" | "SUBMITTED" | "MATCHED" | "MISMATCHED" | "UNRESOLVED" | "PAID" | "REFUNDED";
export type Order = Record<string, any> & { order_id: string; state: Status; amount: string | number; buyer: string; supplier: string; criteria: Array<Record<string, string>>; current_packet?: Record<string, any> | null };
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
export function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase()); }
export function statusTone(status: string) { return ["MATCHED", "PAID"].includes(status) ? "good" : ["MISMATCHED", "REFUNDED"].includes(status) ? "bad" : status === "UNRESOLVED" ? "warn" : "neutral"; }
export function statusDescription(status: string) {
  return ({ DRAFT: "Order definition sealed; awaiting exact escrow.", FUNDED: "Escrow funded; buyer activation is still required.", OPEN: "Supplier can submit one immutable reconciliation packet.", SUBMITTED: "Packet submitted; semantic reconciliation is pending.", MATCHED: "All required criteria satisfied; supplier can claim exact escrow.", MISMATCHED: "A material criterion was violated; buyer can recover escrow.", UNRESOLVED: "Evidence or validator agreement was insufficient; repair budget controls liveness.", PAID: "Exact escrow paid once to the stored supplier.", REFUNDED: "Exact escrow returned once to the stored buyer." } as Record<string, string>)[status] || "Authoritative state read from MatchPay.";
}
export function actionCopy(status: string) {
  return ({ DRAFT: "The buyer must fund the exact frozen amount before the escrow can open.", FUNDED: "The buyer activates the funded order so the supplier can submit evidence.", OPEN: "The supplier submits invoice and delivery evidence against the frozen purchase order.", SUBMITTED: "An independent GenLayer adjudication compares all required criteria before any settlement path opens.", MATCHED: "The supplier may claim the stored escrow exactly once after semantic agreement.", MISMATCHED: "The buyer may recover the exact escrow because a material criterion was violated.", UNRESOLVED: "The supplier can spend the bounded repair budget; after exhaustion, the buyer can recover safely.", PAID: "Settlement is final: the stored supplier has received the exact frozen amount.", REFUNDED: "Settlement is final: the stored buyer has received the exact frozen amount." } as Record<string, string>)[status] || "Follow the state machine to continue.";
}
export function isActionable(order: Order, account: string | null, action: string) {
  const buyer = account?.toLowerCase() === String(order.buyer).toLowerCase();
  const supplier = account?.toLowerCase() === String(order.supplier).toLowerCase();
  if (action === "fund") return buyer && order.state === "DRAFT";
  if (action === "activate") return buyer && order.state === "FUNDED";
  if (action === "submit") return supplier && order.state === "OPEN";
  if (action === "repair") return supplier && order.state === "UNRESOLVED" && Number(order.current_packet?.revision || 0) <= Number(order.max_repairs || 0);
  if (action === "settle") return supplier && order.state === "MATCHED";
  if (action === "refund") return buyer && (order.state === "MISMATCHED" || (order.state === "UNRESOLVED" && Number(order.current_packet?.revision || 0) > Number(order.max_repairs || 0)));
  return action === "adjudicate" && order.state === "SUBMITTED";
}
