import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Menu,
  Plus,
  RefreshCw,
  ShieldCheck,
  Stamp,
  Wallet,
  X,
} from "lucide-react";
import "./editorial.css";
import {
  CONTRACT_ADDRESS,
  connectWallet,
  currentWallet,
  errorMessage,
  explorerContract,
  explorerTx,
  formatGen,
  parseGen,
  readOrder,
  readOrders,
  short,
  sameAddress,
  watchWallet,
  writeMethod,
  type TxStatus,
} from "./genlayer";
import { CRITERIA, actionCopy, isActionable, label, parseJson, statusDescription, statusTone, type Order, type Status } from "./product";

type FormState = { supplier: string; amount: string; poUrl: string; invoiceReq: string; deliveryReq: string; deadline: string; repairs: string };
type PacketForm = { invoiceUrl: string; receiptUrl: string; invoiceNumber: string; receiptNumber: string; deliveryReference: string };
type DocumentInfo = { kind: string; id: string; url: string; note?: string };

const INITIAL_FORM: FormState = {
  supplier: "",
  amount: "1",
  poUrl: "",
  invoiceReq: "Invoice must bind to the purchase order, supplier, line items, quantity, price, and payment terms.",
  deliveryReq: "Receipt must bind to the purchase order, destination, delivered scope, quantity, and acceptance evidence.",
  deadline: "2099-01-01T00:00:00Z",
  repairs: "1",
};
const INITIAL_PACKET: PacketForm = { invoiceUrl: "", receiptUrl: "", invoiceNumber: "", receiptNumber: "", deliveryReference: "" };
const PROOF_CASES = [
  {
    orderId: "live-match",
    mark: "A",
    result: "MATCH",
    eyebrow: "Documents reconcile",
    title: "Compatible paperwork. Payment released.",
    copy: "The purchase order, supplier invoice and goods receipt agree on identity, scope, quantity and acceptance.",
    accent: "match",
    transfer: "Supplier paid exactly 0.01 GEN.",
    transactions: [
      ["Adjudication", "0xddb977d7681150142b1197ff9a662f574e91392be47519a9350a5d26c8ab62944"],
      ["Settlement", "0x84a27d16ebc88be577c9826472cb9c6c0a820ab89ca965a4e971783619fbfadd"],
    ],
  },
  {
    orderId: "live-mismatch",
    mark: "B",
    result: "MATERIAL MISMATCH",
    eyebrow: "Substitution caught",
    title: "Plausible paperwork. Payment blocked.",
    copy: "The packet looks commercial, but an independent reconciliation identifies a material substitution against the frozen order.",
    accent: "mismatch",
    transfer: "Supplier blocked; buyer refunded exactly 0.01 GEN.",
    transactions: [
      ["Adjudication", "0x6bc06b32db48292bf45ccaf7a7b46ad360d79802ea468a4ef550304bd3c14cbe"],
      ["Refund", "0x3a7aa972ab781b1daba201700b2633bb5c881ea67e929712cf0964d8f80bb2e6"],
    ],
  },
  {
    orderId: "live-unresolved",
    mark: "C",
    result: "UNRESOLVED",
    eyebrow: "Fail-closed evidence",
    title: "Evidence unavailable. Escrow stays safe.",
    copy: "When a committed source cannot be resolved, the contract never turns uncertainty into payment. The exhausted repair budget closes safely.",
    accent: "unresolved",
    transfer: "No semantic authorization; buyer refunded exactly 0.01 GEN.",
    transactions: [
      ["Adjudication", "0xa24b05fd14c8c05170a61f2cc89530c83b4fbb391dedd4a27c264d7ed8f4f7c0"],
      ["Refund", "0x5517b896d88e08b35a41fcfed5bea2f9418e2cbed0b19d59c08cbed28236ee05"],
    ],
  },
] as const;

function manifest(id: string, url: string) { return JSON.stringify([{ document_id: id, url: url.trim(), sha256: "" }]); }
function criteriaJson() { return JSON.stringify(CRITERIA.map(([criterion_id, title]) => ({ criterion_id, requirement: `${title} must reconcile with the frozen purchase order and acceptance policy.` }))); }
function asOrder(orderId: string, value: Record<string, any>): Order { return { ...value, order_id: orderId, state: value.state as Status, amount: value.amount, buyer: String(value.buyer), supplier: String(value.supplier), criteria: parseJson<Array<Record<string, string>>>(value.criteria, []) }; }
function amountOf(order: Order) { try { return formatGen(BigInt(String(order.amount))); } catch { return "—"; } }
function getDocuments(order: Order): DocumentInfo[] {
  const po = parseJson<Array<Record<string, string>>>(order.purchase_order_manifest, []);
  const current = order.current_packet || {};
  const invoice = parseJson<Array<Record<string, string>>>(current.invoice_manifest, []);
  const receipt = parseJson<Array<Record<string, string>>>(current.delivery_manifest, []);
  return [
    { kind: "Purchase order", id: po[0]?.document_id || "po-pending", url: po[0]?.url || "", note: "Frozen before funding" },
    { kind: "Supplier invoice", id: invoice[0]?.document_id || "invoice-pending", url: invoice[0]?.url || "", note: invoice[0]?.url ? "Committed source" : "Awaiting packet" },
    { kind: "Goods receipt", id: receipt[0]?.document_id || "receipt-pending", url: receipt[0]?.url || "", note: receipt[0]?.url ? "Committed source" : "Awaiting packet" },
  ];
}
function getCriteria(order: Order): Array<Record<string, any>> {
  const result = parseJson<Record<string, any>>(order.current_packet?.semantic_result, {});
  return Array.isArray(result.criteria) ? result.criteria : [];
}
function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const orderMatch = path.match(/^\/app\/orders\/([^/]+)$/);
  if (orderMatch) return { path: "/app/orders/:id", orderId: decodeURIComponent(orderMatch[1]) };
  if (["/", "/app", "/app/create", "/proof"].includes(path)) return { path };
  return { path: "/" };
}
function navigate(path: string) { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); window.scrollTo({ top: 0, behavior: "auto" }); }
function useRoute() {
  const [route, setRoute] = useState(getRoute);
  useEffect(() => { const onPop = () => setRoute(getRoute()); window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, []);
  return route;
}
function useOrderRegistry(enabled: boolean, refreshToken: number) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError("");
    try {
      const ids = await readOrders();
      const next = await Promise.all(ids.map(async (id) => asOrder(id, await readOrder(id))));
      setOrders(next);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [enabled]);
  useEffect(() => { void load(); }, [load, refreshToken]);
  return { orders, loading, error, reload: load };
}

function App() {
  const route = useRoute();
  const needsOrders = route.path === "/app" || route.path === "/proof" || route.path === "/app/orders/:id";
  const [account, setAccount] = useState<string | null>(null);
  const [tx, setTx] = useState<TxStatus | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [packet, setPacket] = useState<PacketForm>(INITIAL_PACKET);
  const registry = useOrderRegistry(needsOrders, refreshToken);
  useEffect(() => { void currentWallet().then(setAccount).catch(() => undefined); return watchWallet(setAccount); }, []);
  const connect = async () => { try { setAccount(await connectWallet()); } catch (cause) { setTx({ stage: "WALLET ERROR", message: errorMessage(cause), error: errorMessage(cause) }); } };
  const write = async (method: string, args: unknown[], value = 0n) => {
    let signer = account;
    try {
      if (!signer) { signer = await connectWallet(); setAccount(signer); }
      const hash = await writeMethod(signer, method, args, value, setTx);
      setTx({ stage: "CONFIRMED", message: "Authoritative chain state updated.", hash });
      setRefreshToken((token) => token + 1);
      return hash;
    } catch (cause) { setTx({ stage: "EXECUTION FAILED", message: errorMessage(cause), error: errorMessage(cause) }); return null; }
  };
  const createOrder = async () => {
    try {
      if (!form.supplier || !form.poUrl) throw new Error("Supplier address and purchase-order URL are required.");
      const hash = await write("create_order", ["order-" + Date.now().toString(36), form.supplier, parseGen(form.amount), manifest("po", form.poUrl), criteriaJson(), form.invoiceReq, form.deliveryReq, form.deadline, Number(form.repairs)]);
      if (hash) { setForm(INITIAL_FORM); navigate("/app"); }
    } catch (cause) { setTx({ stage: "INPUT ERROR", message: errorMessage(cause), error: errorMessage(cause) }); }
  };
  const submitPacket = async (order: Order, nextPacket: PacketForm, repair = false) => {
    try {
      if (!nextPacket.invoiceUrl || !nextPacket.receiptUrl || !nextPacket.invoiceNumber || !nextPacket.receiptNumber || !nextPacket.deliveryReference) throw new Error("Invoice, receipt, and all document identifiers are required.");
      const args = [order.order_id, manifest("invoice", nextPacket.invoiceUrl), manifest("receipt", nextPacket.receiptUrl), JSON.stringify({ invoice_number: nextPacket.invoiceNumber, receipt_number: nextPacket.receiptNumber, delivery_reference: nextPacket.deliveryReference })];
      const hash = await write(repair ? "repair_packet" : "submit_packet", args);
      if (hash) setPacket(INITIAL_PACKET);
    } catch (cause) { setTx({ stage: "INPUT ERROR", message: errorMessage(cause), error: errorMessage(cause) }); }
  };
  const order = route.orderId ? registry.orders.find((item) => item.order_id === route.orderId) : undefined;
  return <div className="site-shell"><SiteHeader account={account} onConnect={() => void connect()} />{route.path === "/" && <LandingPage />}{route.path === "/app" && <DeskPage orders={registry.orders} loading={registry.loading} error={registry.error} onRefresh={() => void registry.reload()} />}{route.path === "/app/create" && <CreatePage form={form} setForm={setForm} onCreate={() => void createOrder()} />}{route.path === "/app/orders/:id" && <DossierPage order={order} loading={registry.loading} error={registry.error} account={account} tx={tx} packet={packet} setPacket={setPacket} onWrite={write} onSubmitPacket={submitPacket} />}{route.path === "/proof" && <ProofPage orders={registry.orders} loading={registry.loading} error={registry.error} />}<SiteFooter /></div>;
}

function SiteHeader({ account, onConnect }: { account: string | null; onConnect: () => void }) {
  return <header className="site-header"><div className="site-header-inner"><button className="brand" onClick={() => navigate("/")} aria-label="MatchPay home"><span className="brand-mark">M</span><span><strong>matchpay</strong><small>commercial settlement</small></span></button><nav className="site-nav" aria-label="Primary navigation"><button onClick={() => navigate("/app")}>Settlement desk</button><button onClick={() => navigate("/proof")}>Live proof</button><button onClick={() => navigate("/app/create")}>Create order</button></nav><div className="header-actions"><a className="network-link" href={CONTRACT_ADDRESS ? explorerContract() : "#"} target="_blank" rel="noreferrer"><span className="network-dot" />Studio Dev <ExternalLink size={13} /></a><button className="wallet-button" onClick={onConnect}><Wallet size={15} />{account ? short(account, 6, 4) : "Connect wallet"}</button><Menu className="mobile-menu-icon" size={20} /></div></div></header>;
}

function LandingPage() {
  return <main className="landing-page"><section className="hero-section page-width"><div className="hero-copy"><div className="kicker"><span>01 / MatchPay</span><span>Document reconciliation for real commerce</span></div><h1>Match the<br /><em>paperwork</em><br />before the payment.</h1><p className="hero-lede">MatchPay reconciles the purchase order, supplier invoice and goods receipt before a deterministic settlement path opens.</p><div className="hero-actions"><button className="button button-dark" onClick={() => navigate("/proof")}>Open live proof <ArrowUpRight size={16} /></button><button className="text-button" onClick={() => navigate("/app")}>Enter settlement desk <ArrowRight size={16} /></button></div><div className="hero-footnote"><span>GenLayer semantic review</span><span>Native GEN settlement</span></div></div><HeroComposition /></section><section className="manifesto-section page-width"><div className="section-index">02 / The mechanism</div><div className="manifesto-grid"><p className="display-statement">Commercial truth is usually spread across three documents.</p><p className="body-copy">MatchPay gives them one shared case file, one independent meaning check and one unambiguous settlement path.</p></div><DocumentRelationship /></section><ProcessSection /><section className="proof-teaser"><div className="page-width"><div className="section-index light">04 / A live Studio Dev proof</div><div className="proof-teaser-head"><h2>Three cases.<br /><span>Three honest outcomes.</span></h2><button className="button button-paper" onClick={() => navigate("/proof")}>Read the proof <ArrowUpRight size={16} /></button></div><div className="proof-preview">{PROOF_CASES.map((item) => <button className={`proof-preview-row ${item.accent}`} key={item.orderId} onClick={() => navigate("/proof")}><span className="proof-mark">{item.mark}</span><span><strong>{item.result}</strong><small>{item.orderId}</small></span><span className="proof-preview-copy">{item.transfer}</span><ArrowRight size={18} /></button>)}</div></div></section><section className="why-section page-width"><div className="section-index">05 / Why GenLayer</div><div className="why-grid"><h2>Meaning before<br /><em>movement.</em></h2><div><p className="body-copy">A hash can prove that a document is unchanged. It cannot decide whether an invoice actually describes the ordered goods. MatchPay uses GenLayer to reconcile meaning across independent validators, then hands the result to a contract with no discretionary payout path.</p><div className="why-notes"><span>Independent semantic adjudication</span><span>Fail-closed unresolved state</span><span>Exact native transfer</span></div></div></div></section></main>;
}
function HeroComposition() { return <div className="hero-composition" aria-label="Purchase order, invoice and goods receipt reconciled by MatchPay"><div className="hero-grid-line line-one" /><div className="hero-grid-line line-two" /><DocumentSheet document={{ kind: "Purchase order", id: "PO-1042", url: "", note: "FROZEN SOURCE" }} className="hero-sheet sheet-po" compact /><DocumentSheet document={{ kind: "Supplier invoice", id: "INV-8821", url: "", note: "RECONCILED" }} className="hero-sheet sheet-invoice" compact /><DocumentSheet document={{ kind: "Goods receipt", id: "GRN-491", url: "", note: "ACCEPTED" }} className="hero-sheet sheet-receipt" compact /><div className="hero-review-mark"><span>MatchPay review</span><strong>MATCH</strong><small>0.01 GEN payable</small></div><span className="annotation annotation-one">order → invoice</span><span className="annotation annotation-two">invoice → receipt</span></div>; }
function DocumentRelationship() { return <div className="relationship"><div className="relationship-doc"><span>01</span><strong>Purchase order</strong><small>the frozen promise</small></div><ArrowDownRight className="relationship-arrow" /><div className="relationship-core"><Stamp size={19} /><span>MatchPay</span><small>semantic review</small></div><ArrowDownRight className="relationship-arrow reverse" /><div className="relationship-doc"><span>02 / 03</span><strong>Invoice + receipt</strong><small>the claimed reality</small></div><div className="relationship-result"><span>settlement decision</span><strong>PAY / REFUND</strong></div></div>; }
function ProcessSection() { const steps = [["01", "Freeze the purchase order", "The commercial terms, counterparty and source set become the case file."], ["02", "Receive invoice + receipt", "The supplier submits one immutable packet against that frozen definition."], ["03", "Reconcile meaning", "GenLayer compares what the documents say, not just whether they exist."], ["04", "Pay or refund deterministically", "The contract releases exact escrow or returns it to the buyer."]]; return <section className="process-section page-width"><div className="section-index">03 / How it works</div><div className="process-list">{steps.map(([number, title, copy]) => <div className="process-row" key={number}><span className="process-number">{number}</span><h3>{title}</h3><p>{copy}</p><ArrowUpRight size={19} /></div>)}</div></section>; }

function DeskPage({ orders, loading, error, onRefresh }: { orders: Order[]; loading: boolean; error: string; onRefresh: () => void }) { return <main className="page-width app-page"><div className="page-lead"><div><div className="section-index">Settlement desk / live registry</div><h1>Work from the<br /><em>case file.</em></h1><p>The authoritative order registry, presented as commercial work rather than protocol telemetry.</p></div><div className="lead-actions"><button className="button button-dark" onClick={() => navigate("/app/create")}><Plus size={16} /> New purchase order</button><button className="icon-button" onClick={onRefresh} aria-label="Refresh orders"><RefreshCw size={17} /></button></div></div>{error && <Notice message={error} />}{loading ? <LoadingState label="Reading authoritative order registry…" /> : <section className="ledger-section"><div className="ledger-heading"><span>Order register</span><span>{orders.length} live records · Studio Dev 61997</span></div>{orders.length ? <div className="ledger-list">{orders.map((order) => <OrderLedgerRow key={order.order_id} order={order} />)}</div> : <EmptyState title="No orders yet" copy="Create the first frozen purchase order to begin a settlement case." action="Create purchase order" onAction={() => navigate("/app/create")} />}</section>}</main>; }
function OrderLedgerRow({ order }: { order: Order }) { return <div className="ledger-row"><div className="ledger-ref"><span className="mono-label">REFERENCE</span><strong>{order.order_id}</strong><small>{sameAddress(order.buyer, order.supplier) ? "Single-party case" : "Buyer / supplier case"}</small></div><div className="ledger-party"><span className="mono-label">SUPPLIER</span><strong>{short(order.supplier, 10, 7)}</strong><small>stored counterparty</small></div><div className="ledger-amount"><span className="mono-label">FROZEN AMOUNT</span><strong>{amountOf(order)}</strong><small>immutable escrow</small></div><div className="ledger-stage"><span className="mono-label">CURRENT STAGE</span><StatusPill status={order.state} /><small>{nextAction(order)}</small></div><button className="row-arrow" onClick={() => navigate(`/app/orders/${encodeURIComponent(order.order_id)}`)} aria-label={`Open ${order.order_id}`}><ArrowUpRight size={19} /></button></div>; }

function DossierPage({ order, loading, error, account, tx, packet, setPacket, onWrite, onSubmitPacket }: { order?: Order; loading: boolean; error: string; account: string | null; tx: TxStatus | null; packet: PacketForm; setPacket: (value: PacketForm) => void; onWrite: (method: string, args: unknown[], value?: bigint) => Promise<string | null>; onSubmitPacket: (order: Order, packet: PacketForm, repair?: boolean) => Promise<void> }) {
  if (loading) return <main className="page-width app-page"><LoadingState label="Opening the authoritative case file…" /></main>;
  if (error) return <main className="page-width app-page"><Notice message={error} /></main>;
  if (!order) return <main className="page-width app-page"><EmptyState title="Case file not found" copy="This route only opens orders returned by the authoritative MatchPay registry." action="Back to settlement desk" onAction={() => navigate("/app")} /></main>;
  const documents = getDocuments(order); const criteria = getCriteria(order); const semantic = parseJson<Record<string, any>>(order.current_packet?.semantic_result, {}); const repairReady = isActionable(order, account, "repair");
  return <main className="page-width dossier-page"><button className="back-link" onClick={() => navigate("/app")}><ArrowRight size={15} className="back-arrow" />Back to settlement desk</button><section className="case-header"><div><div className="section-index">Commercial case file / {order.order_id}</div><h1>{order.order_id}</h1><p>{statusDescription(order.state)}</p></div><div className="case-status"><StatusPill status={order.state} /><strong>{amountOf(order)}</strong><span>frozen settlement amount</span></div></section><section className="case-meta"><Meta label="Buyer" value={short(order.buyer, 13, 10)} /><Meta label="Supplier" value={short(order.supplier, 13, 10)} /><Meta label="Order state" value={label(order.state)} /><Meta label="Registry" value="Studio Dev / 61997" /></section><StateTrack state={order.state} /><section className="dossier-documents"><div className="dossier-section-head"><div><div className="section-index">01 / Source set</div><h2>Three documents.<br /><em>One decision.</em></h2></div><span className="freeze-note"><ShieldCheck size={15} />Frozen before funding</span></div><div className="document-triptych">{documents.map((document, index) => <div className="document-slot" key={document.kind}><DocumentSheet document={document} />{index < 2 && <ArrowRight className="document-slot-arrow" />}</div>)}</div></section><section className={`reconciliation-section ${order.state === "MISMATCHED" ? "is-mismatch" : order.state === "UNRESOLVED" ? "is-unresolved" : ""}`}><div className="reconciliation-head"><div><div className="section-index">02 / MatchPay review</div><h2>Meaning before<br /><em>movement.</em></h2></div><ResultStamp order={order} /></div><div className="reconciliation-body"><CriterionLedger criteria={criteria} /><div className="review-note"><span className="mono-label">ADJUDICATION NOTE</span><p>{semantic.reasoning || "The packet has not produced an authoritative semantic result yet."}</p>{order.current_packet?.fingerprint && <span className="fingerprint"><Fingerprint size={13} />{short(order.current_packet.fingerprint, 14, 10)}</span>}</div></div></section><ActionRail order={order} account={account} tx={tx} packet={packet} setPacket={setPacket} repairReady={repairReady} onWrite={onWrite} onSubmitPacket={onSubmitPacket} /></main>;
}

function CreatePage({ form, setForm, onCreate }: { form: FormState; setForm: (value: FormState) => void; onCreate: () => void }) {
  const [step, setStep] = useState(0); const steps = ["Parties + amount", "Purchase order", "Invoice rules", "Delivery rules", "Repair policy", "Review + freeze"]; const update = (key: keyof FormState, value: string) => setForm({ ...form, [key]: value });
  return <main className="page-width create-page"><button className="back-link" onClick={() => navigate("/app")}><ArrowRight size={15} className="back-arrow" />Back to settlement desk</button><div className="create-intro"><div><div className="section-index">New commercial case</div><h1>Freeze the<br /><em>definition.</em></h1><p>A settlement case starts with a shared understanding of what was ordered. Work through the source, rules and repair policy before any escrow moves.</p></div><div className="freeze-callout"><LockKeyhole size={18} /><strong>Nothing funds until you freeze.</strong><span>The purchase order becomes immutable contract state after creation.</span></div></div><div className="create-layout"><aside className="create-steps" aria-label="Creation steps">{steps.map((title, index) => <button className={index === step ? "active" : index < step ? "complete" : ""} key={title} onClick={() => setStep(index)}><span>{index < step ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>{title}</button>)}</aside><section className="create-panel"><div className="panel-kicker">Step {String(step + 1).padStart(2, "0")} / {steps.length}</div>{step === 0 && <Step title="Who is this settlement for?" copy="Set the stored supplier and the exact amount that will be protected." fields={<><Field label="Supplier address" value={form.supplier} onChange={(value) => update("supplier", value)} placeholder="0x…" /><Field label="Escrow amount · GEN" value={form.amount} onChange={(value) => update("amount", value)} placeholder="1.0" /></>} />}{step === 1 && <Step title="Which purchase order is frozen?" copy="Use a committed HTTPS source. This reference becomes the root of the reconciliation." fields={<Field label="Purchase-order URL" value={form.poUrl} onChange={(value) => update("poUrl", value)} placeholder="https://…" wide hint="The contract stores this source as the purchase-order manifest." />} />}{step === 2 && <Step title="What must the invoice prove?" copy="Describe the commercial requirements the supplier invoice must satisfy." fields={<TextField label="Invoice requirements" value={form.invoiceReq} onChange={(value) => update("invoiceReq", value)} />} />}{step === 3 && <Step title="What counts as delivery?" copy="Make the receipt requirement explicit before anyone can submit evidence." fields={<TextField label="Delivery / receipt requirements" value={form.deliveryReq} onChange={(value) => update("deliveryReq", value)} />} />}{step === 4 && <Step title="How should uncertainty resolve?" copy="Choose the deadline and the bounded repair budget. An unresolved case never silently pays." fields={<div className="form-grid"><Field label="Submission deadline · UTC" value={form.deadline} onChange={(value) => update("deadline", value)} placeholder="2099-01-01T00:00:00Z" /><Field label="Repair revisions" value={form.repairs} onChange={(value) => update("repairs", value)} placeholder="0–3" /></div>} />}{step === 5 && <ReviewStep form={form} />}<div className="create-actions"><button className="text-button" onClick={() => step ? setStep(step - 1) : navigate("/app")}><ArrowRight size={15} className="back-arrow" />{step ? "Back" : "Cancel"}</button>{step < steps.length - 1 ? <button className="button button-dark" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} /></button> : <button className="button button-green" onClick={onCreate}><LockKeyhole size={16} />Freeze purchase order</button>}</div></section></div></main>;
}
function Step({ title, copy, fields }: { title: string; copy: string; fields: ReactNode }) { return <div className="form-step"><h2>{title}</h2><p>{copy}</p><div className="form-fields">{fields}</div></div>; }
function ReviewStep({ form }: { form: FormState }) { return <div className="form-step review-step"><div className="review-banner"><ShieldCheck size={22} /><span><strong>Ready to freeze</strong><small>Review these terms before the contract stores them.</small></span></div><ReviewLine label="Supplier" value={form.supplier || "Not set"} /><ReviewLine label="Protected amount" value={`${form.amount || "0"} GEN`} /><ReviewLine label="Purchase order" value={form.poUrl || "Not set"} /><ReviewLine label="Repair policy" value={`${form.repairs || "0"} revisions · deadline ${form.deadline || "Not set"}`} /><p className="review-footnote">After creation, the order definition cannot be edited. Funding is a separate wallet-authorized action.</p></div>; }
function ReviewLine({ label: title, value }: { label: string; value: string }) { return <div className="review-line"><span>{title}</span><strong>{value}</strong></div>; }
function Field({ label: title, value, onChange, placeholder, wide = false, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; wide?: boolean; hint?: string }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{title}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{hint && <small>{hint}</small>}</label>; }
function TextField({ label: title, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="field wide"><span>{title}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={6} /></label>; }

function ProofPage({ orders, loading, error }: { orders: Order[]; loading: boolean; error: string }) { const byId = useMemo(() => new Map(orders.map((order) => [order.order_id, order])), [orders]); return <main className="proof-page"><section className="proof-hero page-width"><div className="section-index light">Live Studio Dev proof / canonical cases</div><h1>What did the<br /><em>documents say?</em></h1><p>Three real orders show the only settlement outcomes MatchPay should permit: pay when meaning matches, refund when it does not, and fail closed when evidence cannot be resolved.</p><div className="proof-hero-meta"><span>Anonymous review</span><span>Chain 61997</span><span>Exact native transfers</span></div></section><section className="proof-cases page-width">{error && <Notice message={error} light />}{loading ? <LoadingState label="Reading the three canonical cases from Studio Dev…" light /> : PROOF_CASES.map((item) => <ProofCase key={item.orderId} item={item} order={byId.get(item.orderId)} />)}</section></main>; }
function ProofCase({ item, order }: { item: typeof PROOF_CASES[number]; order?: Order }) { const docs = order ? getDocuments(order) : []; const criteria = order ? getCriteria(order) : []; return <article className={`proof-case proof-case-${item.accent}`}><div className="proof-case-heading"><span className="proof-case-mark">{item.mark}</span><div><span className="mono-label">{item.orderId} / {item.eyebrow}</span><h2>{item.result}</h2><p>{item.title}</p></div>{order && <StatusPill status={order.state} />}</div><div className="proof-case-copy"><p>{item.copy}</p><strong>{item.transfer}</strong></div><div className="proof-case-grid"><div className="proof-docs"><span className="mono-label">SOURCE DOCUMENTS</span>{docs.length ? docs.map((doc) => <DocumentSheet key={doc.kind} document={doc} compact />) : <span className="proof-pending">Waiting for the authoritative order read.</span>}</div><div className="proof-verdict"><span className="mono-label">CRITERION RESULT</span>{criteria.length ? <CriterionLedger criteria={criteria} compact /> : <div className="proof-pending">No semantic result has been read yet.</div>}<span className="mono-label proof-tx-label">AUTHORITATIVE TRANSACTIONS</span><div className="proof-transactions">{item.transactions.map(([name, hash]) => <a href={explorerTx(hash)} target="_blank" rel="noreferrer" key={hash}><span>{name}</span><code>{short(hash, 12, 9)}</code><ArrowUpRight size={13} /></a>)}</div></div></div></article>; }

function DocumentSheet({ document, className = "", compact = false }: { document: DocumentInfo; className?: string; compact?: boolean }) { return <div className={`document-sheet ${compact ? "compact" : ""} ${className}`}><div className="sheet-edge" /><div className="sheet-top"><span>{document.kind}</span><Fingerprint size={14} /></div><div className="sheet-id">{document.id}</div>{!compact && <><div className="sheet-rule" /><div className="sheet-lines"><i /><i /><i /></div></>}{document.url ? <a className="sheet-url" href={document.url} target="_blank" rel="noreferrer">{short(document.url, compact ? 28 : 42, 11)} <ExternalLink size={12} /></a> : <span className="sheet-url muted">{document.note || "Awaiting source"}</span>}<span className="sheet-note">{document.note || "Committed commercial source"}</span></div>; }
function CriterionLedger({ criteria, compact = false }: { criteria: Array<Record<string, any>>; compact?: boolean }) { if (!criteria.length) return <div className="unreviewed"><Fingerprint size={17} />No semantic result recorded yet.</div>; return <div className={`criterion-ledger ${compact ? "compact" : ""}`}>{criteria.map((item) => { const status = String(item.status || "UNRESOLVED"); const failed = status === "VIOLATED"; return <div className={`criterion-line ${failed ? "failed" : status === "UNRESOLVED" ? "unclear" : ""}`} key={String(item.criterion_id)}><span className="criterion-icon">{status === "SATISFIED" ? <Check size={14} /> : status === "VIOLATED" ? <X size={14} /> : "?"}</span><span className="criterion-detail"><strong>{label(String(item.criterion_id || "criterion"))}</strong>{!compact && <small>{item.observed_fact || "No observed fact recorded."}</small>}{!compact && item.witness_evidence_ids?.length ? <code>Witness · {item.witness_evidence_ids.join(" · ")}</code> : null}</span><span className="criterion-state">{label(status)}</span></div>; })}</div>; }

function ActionRail({ order, account, tx, packet, setPacket, repairReady, onWrite, onSubmitPacket }: { order: Order; account: string | null; tx: TxStatus | null; packet: PacketForm; setPacket: (value: PacketForm) => void; repairReady: boolean; onWrite: (method: string, args: unknown[], value?: bigint) => Promise<string | null>; onSubmitPacket: (order: Order, packet: PacketForm, repair?: boolean) => Promise<void> }) { const can = (action: string) => isActionable(order, account, action); const action = nextAction(order); return <section className="action-rail"><div className="action-rail-head"><span className="mono-label">NEXT REQUIRED ACTION</span><h3>{action}</h3><p>{actionCopy(order.state)}</p></div>{order.state === "DRAFT" && <button className="button button-green wide-button" disabled={!can("fund")} onClick={() => void onWrite("fund_order", [order.order_id], BigInt(String(order.amount)))}>Fund exact escrow <ArrowRight size={16} /></button>}{order.state === "FUNDED" && <button className="button button-dark wide-button" disabled={!can("activate")} onClick={() => void onWrite("activate_order", [order.order_id])}>Activate order <ArrowRight size={16} /></button>}{(order.state === "OPEN" || repairReady) && <PacketFields packet={packet} setPacket={setPacket} onSubmit={() => void onSubmitPacket(order, packet, repairReady)} repair={repairReady} disabled={!can(repairReady ? "repair" : "submit")} />}{order.state === "SUBMITTED" && <button className="button button-dark wide-button" disabled={!account} onClick={() => void onWrite("adjudicate_order", [order.order_id])}>Run GenLayer reconciliation <ArrowRight size={16} /></button>}{order.state === "MATCHED" && <button className="button button-green wide-button" disabled={!can("settle")} onClick={() => void onWrite("settle_match", [order.order_id])}>Pay supplier · {amountOf(order)} <ArrowRight size={16} /></button>}{(order.state === "MISMATCHED" || order.state === "UNRESOLVED") && <button className="button button-orange wide-button" disabled={!can("refund")} onClick={() => void onWrite("refund_order", [order.order_id])}>Refund buyer escrow <ArrowRight size={16} /></button>}{tx && <TxBox tx={tx} />}</section>; }
function PacketFields({ packet, setPacket, onSubmit, repair, disabled }: { packet: PacketForm; setPacket: (value: PacketForm) => void; onSubmit: () => void; repair: boolean; disabled: boolean }) { const update = (key: keyof PacketForm, value: string) => setPacket({ ...packet, [key]: value }); return <div className="packet-form"><Field label="Invoice URL" value={packet.invoiceUrl} onChange={(value) => update("invoiceUrl", value)} placeholder="https://…" /><Field label="Receipt URL" value={packet.receiptUrl} onChange={(value) => update("receiptUrl", value)} placeholder="https://…" /><div className="field-row"><Field label="Invoice no." value={packet.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} placeholder="INV-1001" /><Field label="Receipt no." value={packet.receiptNumber} onChange={(value) => update("receiptNumber", value)} placeholder="GRN-1001" /></div><Field label="Delivery reference" value={packet.deliveryReference} onChange={(value) => update("deliveryReference", value)} placeholder="DEL-1001" /><button className="button button-dark wide-button" disabled={disabled} onClick={onSubmit}>{repair ? "Submit repair revision" : "Submit immutable packet"} <ArrowRight size={15} /></button></div>; }
function StateTrack({ state }: { state: string }) { const stages = ["DRAFT", "FUNDED", "OPEN", "SUBMITTED", state === "MISMATCHED" ? "MISMATCHED" : state === "UNRESOLVED" ? "UNRESOLVED" : "MATCHED", state === "PAID" || state === "REFUNDED" ? state : "SETTLEMENT"]; const active = stages.indexOf(state); return <div className="state-track">{stages.map((stage, index) => <div className={`track-item ${index <= active ? "done" : ""} ${stage === state ? "current" : ""}`} key={`${stage}-${index}`}><span>{index < active ? <Check size={12} /> : String(index + 1).padStart(2, "0")}</span><small>{label(stage)}</small></div>)}</div>; }
function ResultStamp({ order }: { order: Order }) { const result = order.state === "MATCHED" || order.state === "PAID" ? "MATCH" : order.state === "MISMATCHED" ? "MATERIAL MISMATCH" : order.state === "UNRESOLVED" || order.state === "REFUNDED" ? "UNRESOLVED / REFUNDED" : "PENDING REVIEW"; return <span className={`result-stamp ${statusTone(order.state)}`}><Stamp size={15} />{result}</span>; }
function Meta({ label: title, value }: { label: string; value: string }) { return <div className="meta-item"><span className="mono-label">{title}</span><strong>{value}</strong></div>; }
function StatusPill({ status }: { status: string }) { return <span className={`status-pill ${statusTone(status)}`}><span />{label(status)}</span>; }
function nextAction(order: Order) { return ({ DRAFT: "Fund exact escrow", FUNDED: "Activate the escrow", OPEN: "Submit evidence packet", SUBMITTED: "Run semantic reconciliation", MATCHED: "Release supplier payment", MISMATCHED: "Return protected escrow", UNRESOLVED: "Repair or close safely", PAID: "Settlement complete", REFUNDED: "Settlement complete" } as Record<string, string>)[order.state] || "Review case file"; }
function Notice({ message, light = false }: { message: string; light?: boolean }) { return <div className={`notice ${light ? "notice-light" : ""}`}><CircleAlert size={17} /><span>{message}</span></div>; }
function LoadingState({ label: text, light = false }: { label: string; light?: boolean }) { return <div className={`loading-state ${light ? "light" : ""}`}><LoaderCircle size={24} className="spin" /><span>{text}</span></div>; }
function EmptyState({ title, copy, action, onAction }: { title: string; copy: string; action: string; onAction: () => void }) { return <div className="empty-state"><FileCheck2 size={31} /><h2>{title}</h2><p>{copy}</p><button className="button button-dark" onClick={onAction}>{action} <ArrowRight size={15} /></button></div>; }
function TxBox({ tx }: { tx: TxStatus }) { return <div className={`tx-box ${tx.stage === "EXECUTION FAILED" || tx.stage === "INPUT ERROR" ? "failed" : ""}`}><div><strong>{tx.stage}</strong><span>{tx.message}</span></div>{tx.hash && <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">View transaction <ArrowUpRight size={12} /></a>}</div>; }
function SiteFooter() { return <footer className="site-footer page-width"><div><span className="brand-mark footer-mark">M</span><strong>matchpay</strong></div><span>Match the paperwork before the payment.</span><span className="footer-meta">Studio Dev · chain 61997 · {short(CONTRACT_ADDRESS, 9, 7)}</span></footer>; }

createRoot(document.getElementById("root")!).render(<App />);
