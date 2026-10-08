import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileText,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import "./styles.css";
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

function manifest(id: string, url: string) { return JSON.stringify([{ document_id: id, url: url.trim(), sha256: "" }]); }
function criteriaJson() { return JSON.stringify(CRITERIA.map(([criterion_id, title]) => ({ criterion_id, requirement: `${title} must reconcile with the frozen purchase order and acceptance policy.` }))); }
function asOrder(orderId: string, value: Record<string, any>): Order { return { ...value, order_id: orderId, state: value.state as Status, amount: value.amount, buyer: String(value.buyer), supplier: String(value.supplier), criteria: parseJson<Array<Record<string, string>>>(value.criteria, []) }; }
function amountOf(order: Order) { try { return formatGen(BigInt(String(order.amount))); } catch { return "—"; } }
function initialForStatus(status: string) { return ({ DRAFT: 1, FUNDED: 2, OPEN: 3, SUBMITTED: 4, MATCHED: 5, MISMATCHED: 5, UNRESOLVED: 5, PAID: 6, REFUNDED: 6 } as Record<string, number>)[status] || 1; }

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readError, setReadError] = useState("");
  const [tx, setTx] = useState<TxStatus | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [packet, setPacket] = useState<PacketForm>(INITIAL_PACKET);
  const [showCreate, setShowCreate] = useState(false);

  const selected = orders.find((order) => order.order_id === selectedId) || orders[0] || null;
  const counts = useMemo(() => orders.reduce<Record<string, number>>((result, order) => { result[order.state] = (result[order.state] || 0) + 1; return result; }, {}), [orders]);

  const refresh = async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setReadError("");
    try {
      const ids = await readOrders();
      const next = await Promise.all(ids.map(async (id) => asOrder(id, await readOrder(id))));
      setOrders(next);
      setSelectedId((current) => next.some((order) => order.order_id === current) ? current : next[0]?.order_id || "");
    } catch (error) { setReadError(errorMessage(error)); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void refresh(); void currentWallet().then(setAccount).catch(() => undefined); return watchWallet(setAccount); }, []);

  const connect = async () => { try { setAccount(await connectWallet()); } catch (error) { setReadError(errorMessage(error)); } };
  const setStatus = (next: TxStatus) => setTx(next);
  const write = async (method: string, args: unknown[], value = 0n) => {
    let signer = account;
    if (!signer) { signer = await connectWallet(); setAccount(signer); }
    try { const hash = await writeMethod(signer, method, args, value, setStatus); await refresh(true); setTx({ stage: "CONFIRMED", message: "Chain state refreshed after the authoritative write.", hash }); }
    catch (error) { setTx({ stage: "EXECUTION FAILED", message: errorMessage(error), error: errorMessage(error) }); }
  };
  const createOrder = async () => {
    try {
      if (!form.supplier || !form.poUrl) throw new Error("Supplier address and purchase-order URL are required.");
      await write("create_order", ["order-" + Date.now().toString(36), form.supplier, parseGen(form.amount), manifest("po", form.poUrl), criteriaJson(), form.invoiceReq, form.deliveryReq, form.deadline, Number(form.repairs)]);
      setShowCreate(false); setForm(INITIAL_FORM);
    } catch (error) { setTx({ stage: "INPUT ERROR", message: errorMessage(error), error: errorMessage(error) }); }
  };
  const submitPacket = async (repair = false) => {
    if (!selected) return;
    try {
      if (!packet.invoiceUrl || !packet.receiptUrl || !packet.invoiceNumber || !packet.receiptNumber || !packet.deliveryReference) throw new Error("Invoice, receipt, and all document identifiers are required.");
      const args = [selected.order_id, manifest("invoice", packet.invoiceUrl), manifest("receipt", packet.receiptUrl), JSON.stringify({ invoice_number: packet.invoiceNumber, receipt_number: packet.receiptNumber, delivery_reference: packet.deliveryReference })];
      await write(repair ? "repair_packet" : "submit_packet", args);
      setPacket(INITIAL_PACKET);
    } catch (error) { setTx({ stage: "INPUT ERROR", message: errorMessage(error), error: errorMessage(error) }); }
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span className="brand-glyph">M</span><span><strong>matchpay</strong><small>commercial settlement</small></span></div>
      <div className="topbar-actions"><a className="text-link" href={CONTRACT_ADDRESS ? explorerContract() : "#"} target="_blank" rel="noreferrer">Studio Dev contract <ArrowRight size={14} /></a><button className="wallet-button" onClick={() => void connect()}><Wallet size={16} />{account ? short(account, 7, 4) : "Connect wallet"}</button></div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-label">Settlement desk</div>
        <button className="new-order" onClick={() => setShowCreate(true)}><Plus size={16} />New purchase order</button>
        <div className="side-label order-label">Orders <span>{orders.length}</span></div>
        <div className="order-list">{orders.map((order) => <button className={`order-row ${selected?.order_id === order.order_id ? "active" : ""}`} key={order.order_id} onClick={() => setSelectedId(order.order_id)}><span className="order-icon"><FileText size={15} /></span><span className="order-row-copy"><strong>{order.order_id}</strong><small>{short(order.supplier, 8, 3)}</small></span><StatusPill status={order.state} compact /></button>)}</div>
        {!loading && orders.length === 0 && <div className="empty-side">No orders have been read from the contract.</div>}
        <div className="side-footer"><div className="network-dot" />Studio Dev · chain 61997</div>
      </aside>
      <main className="main-content">
        <div className="page-heading"><div><div className="eyebrow">Three-document reconciliation</div><h1>Settlement control room</h1><p>Reconcile the commercial truth before native GEN moves.</p></div><button className="refresh-button" onClick={() => void refresh(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spin" : ""} />Refresh chain state</button></div>
        {readError && <div className="notice error"><CircleAlert size={17} /><span>{readError}</span><button onClick={() => setReadError("")}><X size={15} /></button></div>}
        <section className="stat-grid"><Stat label="Orders read" value={String(orders.length)} meta="latest-nonfinal" icon={<FileText size={17} />} /><Stat label="Awaiting evidence" value={String((counts.SUBMITTED || 0) + (counts.UNRESOLVED || 0))} meta="submitted + unresolved" icon={<ReceiptText size={17} />} /><Stat label="Ready to pay" value={String(counts.MATCHED || 0)} meta="supplier settlement" icon={<CircleCheck size={17} />} /><Stat label="Protected escrow" value={String((counts.MISMATCHED || 0) + (counts.UNRESOLVED || 0))} meta="mismatch or unresolved" icon={<LockKeyhole size={17} />} /></section>
        {loading ? <div className="loading-state"><LoaderCircle className="spin" size={24} /><span>Reading authoritative MatchPay state…</span></div> : selected ? <OrderDetail order={selected} account={account} tx={tx} packet={packet} setPacket={setPacket} write={write} submitPacket={submitPacket} /> : <EmptyState onCreate={() => setShowCreate(true)} configured={Boolean(CONTRACT_ADDRESS)} />}
      </main>
    </div>
    {showCreate && <CreateModal form={form} setForm={setForm} onClose={() => setShowCreate(false)} onCreate={() => void createOrder()} />}
  </div>;
}

function OrderDetail({ order, account, tx, packet, setPacket, write, submitPacket }: { order: Order; account: string | null; tx: TxStatus | null; packet: PacketForm; setPacket: (value: PacketForm) => void; write: (method: string, args: unknown[], value?: bigint) => Promise<void>; submitPacket: (repair?: boolean) => Promise<void> }) {
  const po = parseJson<Array<Record<string, string>>>(order.purchase_order_manifest, []);
  const current = order.current_packet || {};
  const semantic = parseJson<Record<string, any>>(current.semantic_result, {});
  const resultCriteria = Array.isArray(semantic.criteria) ? semantic.criteria : [];
  const repairReady = isActionable(order, account, "repair");
  return <>
    <section className="order-hero"><div><div className="breadcrumb">Orders <ChevronDown size={13} /> {order.order_id}</div><div className="hero-title"><h2>{order.order_id}</h2><StatusPill status={order.state} /></div><p>{statusDescription(order.state)}</p></div><div className="hero-amount"><small>Frozen escrow</small><strong>{amountOf(order)}</strong><span><LockKeyhole size={13} /> immutable amount</span></div></section>
    <div className="state-track">{["DRAFT", "FUNDED", "OPEN", "SUBMITTED", order.state === "MISMATCHED" ? "MISMATCHED" : order.state === "UNRESOLVED" ? "UNRESOLVED" : "MATCHED", order.state === "PAID" || order.state === "REFUNDED" ? order.state : "SETTLEMENT"].map((stage, index) => <div className={`track-step ${index < initialForStatus(order.state) ? "done" : ""} ${stage === order.state ? "current" : ""}`} key={`${stage}-${index}`}><span>{index < initialForStatus(order.state) ? <Check size={12} /> : index + 1}</span><small>{label(stage)}</small></div>)}</div>
    <section className="document-board"><div className="section-heading"><div><div className="eyebrow">Authoritative source set</div><h3>Purchase order ↔ invoice ↔ receipt</h3></div><span className="frozen-tag"><ShieldCheck size={14} />frozen before funding</span></div><div className="document-grid"><DocumentCard kind="PURCHASE ORDER" id={po[0]?.document_id || "po"} url={po[0]?.url || ""} /><div className="connector"><ArrowRight size={18} /></div><DocumentCard kind="INVOICE" id={parseJson<any[]>(current.invoice_manifest, [])[0]?.document_id || "invoice"} url={parseJson<any[]>(current.invoice_manifest, [])[0]?.url || ""} /><div className="connector"><ArrowRight size={18} /></div><DocumentCard kind="DELIVERY / RECEIPT" id={parseJson<any[]>(current.delivery_manifest, [])[0]?.document_id || "receipt"} url={parseJson<any[]>(current.delivery_manifest, [])[0]?.url || ""} /></div></section>
    <div className="detail-grid"><section className="card reconciliation-card"><div className="section-heading"><div><div className="eyebrow">GenLayer review</div><h3>Criterion reconciliation</h3></div>{order.state === "MATCHED" && <span className="result-stamp good"><CircleCheck size={14} />MATCH</span>}{order.state === "MISMATCHED" && <span className="result-stamp bad"><CircleAlert size={14} />MATERIAL MISMATCH</span>}{order.state === "UNRESOLVED" && <span className="result-stamp warn"><CircleAlert size={14} />UNRESOLVED</span>}</div>{resultCriteria.length ? <div className="criteria-list">{resultCriteria.map((item) => <div className="criterion" key={item.criterion_id}><div className={`criterion-mark ${item.status === "SATISFIED" ? "good" : item.status === "VIOLATED" ? "bad" : "warn"}`}>{item.status === "SATISFIED" ? <Check size={14} /> : item.status === "VIOLATED" ? <X size={14} /> : "?"}</div><div className="criterion-copy"><strong>{label(item.criterion_id)}</strong><p>{item.observed_fact || "No observed fact recorded."}</p>{item.witness_evidence_ids?.length ? <small>Witness · {item.witness_evidence_ids.join(" · ")}</small> : null}</div><span className={`criterion-status ${statusTone(item.status)}`}>{label(item.status)}</span></div>)}</div> : <div className="unreviewed"><Fingerprint size={19} /><span>This packet has not produced an authoritative semantic result yet.</span></div>}{semantic.reasoning && <div className="reasoning"><span>Adjudication note</span><p>{semantic.reasoning}</p></div>}</section><aside className="right-rail"><ActionPanel order={order} account={account} tx={tx} packet={packet} setPacket={setPacket} write={write} submitPacket={submitPacket} repairReady={repairReady} /></aside></div>
  </>;
}

function ActionPanel({ order, account, tx, packet, setPacket, write, submitPacket, repairReady }: { order: Order; account: string | null; tx: TxStatus | null; packet: PacketForm; setPacket: (value: PacketForm) => void; write: (method: string, args: unknown[], value?: bigint) => Promise<void>; submitPacket: (repair?: boolean) => Promise<void>; repairReady: boolean }) {
  const can = (action: string) => isActionable(order, account, action);
  return <section className="card action-card"><div className="eyebrow">Next protocol action</div><h3>{order.state === "DRAFT" ? "Fund the frozen order" : order.state === "FUNDED" ? "Activate the escrow" : order.state === "OPEN" ? "Submit reconciliation packet" : order.state === "SUBMITTED" ? "Adjudicate the packet" : order.state === "MATCHED" ? "Release supplier payment" : order.state === "MISMATCHED" ? "Return protected escrow" : order.state === "UNRESOLVED" ? "Repair or close safely" : "Settlement complete"}</h3><p className="action-copy">{actionCopy(order.state)}</p>{order.state === "DRAFT" && <ActionButton label="Fund exact escrow" disabled={!can("fund")} onClick={() => void write("fund_order", [order.order_id], BigInt(String(order.amount)))} />} {order.state === "FUNDED" && <ActionButton label="Activate order" disabled={!can("activate")} onClick={() => void write("activate_order", [order.order_id])} />} {(order.state === "OPEN" || repairReady) && <PacketFields packet={packet} setPacket={setPacket} onSubmit={() => void submitPacket(repairReady)} repair={repairReady} disabled={!can(repairReady ? "repair" : "submit")} />} {order.state === "SUBMITTED" && <ActionButton label="Run GenLayer reconciliation" disabled={!account} onClick={() => void write("adjudicate_order", [order.order_id])} />} {order.state === "MATCHED" && <ActionButton label={`Pay supplier · ${amountOf(order)}`} disabled={!can("settle")} onClick={() => void write("settle_match", [order.order_id])} tone="good" />} {(order.state === "MISMATCHED" || order.state === "UNRESOLVED") && <ActionButton label={order.state === "UNRESOLVED" ? "Refund after repair limit" : "Refund buyer escrow"} disabled={!can("refund")} onClick={() => void write("refund_order", [order.order_id])} tone="warn" />} {tx && <TxBox tx={tx} />}</section>;
}

function PacketFields({ packet, setPacket, onSubmit, repair, disabled }: { packet: PacketForm; setPacket: (value: PacketForm) => void; onSubmit: () => void; repair: boolean; disabled: boolean }) { const update = (key: keyof PacketForm, value: string) => setPacket({ ...packet, [key]: value }); return <div className="packet-form"><Field label="Invoice URL" value={packet.invoiceUrl} onChange={(value) => update("invoiceUrl", value)} placeholder="https://…" /><Field label="Receipt URL" value={packet.receiptUrl} onChange={(value) => update("receiptUrl", value)} placeholder="https://…" /><div className="field-row"><Field label="Invoice no." value={packet.invoiceNumber} onChange={(value) => update("invoiceNumber", value)} placeholder="INV-1001" /><Field label="Receipt no." value={packet.receiptNumber} onChange={(value) => update("receiptNumber", value)} placeholder="GRN-1001" /></div><Field label="Delivery reference" value={packet.deliveryReference} onChange={(value) => update("deliveryReference", value)} placeholder="DEL-1001" /><ActionButton label={repair ? "Submit immutable repair revision" : "Submit immutable packet"} disabled={disabled} onClick={onSubmit} /></div>; }
function DocumentCard({ kind, id, url }: { kind: string; id: string; url: string }) { return <div className="document-card"><div className="document-card-head"><span className="doc-type">{kind}</span><Fingerprint size={15} /></div><strong>{id}</strong><a href={url || "#"} target="_blank" rel="noreferrer">{url ? short(url, 25, 8) : "Awaiting packet evidence"}</a><small>{url ? "committed HTTPS source" : "not submitted"}</small></div>; }
function ActionButton({ label: text, disabled, onClick, tone = "default" }: { label: string; disabled: boolean; onClick: () => void; tone?: "default" | "good" | "warn" }) { return <button className={`action-button ${tone}`} disabled={disabled} onClick={onClick}>{text}<ArrowRight size={15} /></button>; }
function TxBox({ tx }: { tx: TxStatus }) { return <div className={`tx-box ${tx.stage === "EXECUTION FAILED" || tx.stage === "INPUT ERROR" ? "failed" : ""}`}><div className="tx-stage"><LoaderCircle size={14} className={tx.stage.includes("PENDING") || tx.stage === "SIMULATING" ? "spin" : ""} /><strong>{tx.stage}</strong></div><p>{tx.message}</p>{tx.hash && <a href={explorerTx(tx.hash)} target="_blank" rel="noreferrer">View transaction {short(tx.hash)}</a>}</div>; }
function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) { return <span className={`status-pill ${statusTone(status)} ${compact ? "compact" : ""}`}><span />{label(status)}</span>; }
function Stat({ label: title, value, meta, icon }: { label: string; value: string; meta: string; icon: ReactNode }) { return <div className="stat"><span className="stat-icon">{icon}</span><div><strong>{value}</strong><span>{title}</span><small>{meta}</small></div></div>; }
function Field({ label: title, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="field"><span>{title}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function EmptyState({ onCreate, configured }: { onCreate: () => void; configured: boolean }) { return <div className="empty-state"><div className="empty-orb"><ShieldCheck size={28} /></div><h2>{configured ? "No commercial orders yet" : "Connect MatchPay to a contract"}</h2><p>{configured ? "Create the first frozen purchase order to begin a three-document settlement." : "The UI is intentionally showing no records until a deployed MatchPay address is configured."}</p>{configured && <button className="new-order" onClick={onCreate}><Plus size={16} />Create first order</button>}</div>; }
function CreateModal({ form, setForm, onClose, onCreate }: { form: FormState; setForm: (value: FormState) => void; onClose: () => void; onCreate: () => void }) { const update = (key: keyof FormState, value: string) => setForm({ ...form, [key]: value }); return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">Buyer workflow</div><h2>New purchase order</h2><p>Terms and source definition are frozen before funding.</p></div><button onClick={onClose}><X size={18} /></button></div><div className="modal-grid"><Field label="Supplier address" value={form.supplier} onChange={(value) => update("supplier", value)} placeholder="0x…" /><Field label="Escrow amount · GEN" value={form.amount} onChange={(value) => update("amount", value)} placeholder="1.0" /><Field label="Purchase-order URL" value={form.poUrl} onChange={(value) => update("poUrl", value)} placeholder="https://…" /><Field label="Submission deadline · UTC" value={form.deadline} onChange={(value) => update("deadline", value)} placeholder="2099-01-01T00:00:00Z" /><label className="field wide"><span>Invoice requirements</span><textarea value={form.invoiceReq} onChange={(event) => update("invoiceReq", event.target.value)} /></label><label className="field wide"><span>Delivery / receipt requirements</span><textarea value={form.deliveryReq} onChange={(event) => update("deliveryReq", event.target.value)} /></label><Field label="Repair revisions" value={form.repairs} onChange={(value) => update("repairs", value)} placeholder="0–3" /></div><div className="modal-foot"><span><LockKeyhole size={14} />Cannot be edited after creation</span><button className="action-button" onClick={onCreate}>Seal order definition <ArrowRight size={15} /></button></div></div></div>; }

createRoot(document.getElementById("root")!).render(<App />);
