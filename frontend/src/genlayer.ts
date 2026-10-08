import { createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionHashVariant, type CalldataEncodable } from "genlayer-js/types";

export const CHAIN_ID = 61997;
export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;
export const RPC_URL = "https://studio-dev.genlayer.com/api";
export const CONTRACT_ADDRESS = String(import.meta.env.VITE_MATCHPAY_CONTRACT_ADDRESS || "");
export const EXPLORER_ROOT = "https://explorer-studio-dev.genlayer.com";

export type Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isRabby?: boolean;
  isMetaMask?: boolean;
  providers?: Provider[];
};
export type TxStatus = { stage: string; message: string; hash?: string; error?: string };

declare global {
  interface Window { ethereum?: Provider; }
}

const chain = { ...studioDevnet, id: CHAIN_ID, name: "GenLayer Studio Dev", rpcUrls: { default: { http: [RPC_URL] } } } as typeof studioDevnet;
const readClient = createClient({ chain });
const readOptions = { transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL, jsonSafeReturn: true };

function provider(): Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const providers = window.ethereum.providers?.filter(Boolean) || [window.ethereum];
  return providers.find((item) => item.isRabby) || providers.find((item) => item.isMetaMask) || providers[0] || null;
}

function requireContract() {
  if (!CONTRACT_ADDRESS) throw new Error("MatchPay is not configured yet. Set VITE_MATCHPAY_CONTRACT_ADDRESS.");
  return CONTRACT_ADDRESS as `0x${string}`;
}

export function sameAddress(left: unknown, right: unknown) { return String(left || "").toLowerCase() === String(right || "").toLowerCase(); }
export function short(value: unknown, left = 8, right = 6) {
  const text = String(value || "");
  return text.length <= left + right + 1 ? text : `${text.slice(0, left)}…${text.slice(-right)}`;
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
export function formatGen(wei: bigint, decimals = 4) {
  const negative = wei < 0n;
  const absolute = negative ? -wei : wei;
  const whole = absolute / 1_000_000_000_000_000_000n;
  const fraction = absolute % 1_000_000_000_000_000_000n;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fractionText ? `.${fractionText}` : ""} GEN`;
}
export function parseGen(value: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim())) throw new Error("Enter a GEN amount with up to 18 decimals.");
  const [whole, decimal = ""] = value.trim().split(".");
  return BigInt(whole) * 1_000_000_000_000_000_000n + BigInt(decimal.padEnd(18, "0") || "0");
}
export function explorerTx(hash: string) { return `${EXPLORER_ROOT}/tx/${hash}`; }
export function explorerContract() { return `${EXPLORER_ROOT}/address/${CONTRACT_ADDRESS}`; }

export async function readMethod<T>(functionName: string, args: unknown[] = []): Promise<T> {
  const value = await (readClient as any).readContract({ address: requireContract(), functionName, args: args as CalldataEncodable[], ...readOptions });
  return value as T;
}
export async function readOrders(): Promise<string[]> { return readMethod<string[]>("get_order_ids"); }
export async function readOrder(orderId: string): Promise<Record<string, any>> { return readMethod<Record<string, any>>("get_order", [orderId]); }

export async function connectWallet(): Promise<string> {
  const wallet = provider();
  if (!wallet) throw new Error("Install Rabby or another injected wallet to write to MatchPay.");
  await wallet.request({ method: "eth_requestAccounts" });
  const chainId = String(await wallet.request({ method: "eth_chainId" })).toLowerCase();
  if (chainId !== CHAIN_HEX) {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  }
  const accounts = await wallet.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("Wallet returned no account.");
  return accounts[0];
}
export async function currentWallet(): Promise<string | null> {
  const wallet = provider();
  if (!wallet) return null;
  const accounts = await wallet.request({ method: "eth_accounts" });
  return Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
}
export function watchWallet(onAccount: (account: string | null) => void) {
  const wallet = provider();
  if (!wallet?.on) return () => undefined;
  const listener = (...args: unknown[]) => onAccount(Array.isArray(args[0]) && typeof args[0][0] === "string" ? args[0][0] : null);
  wallet.on("accountsChanged", listener);
  return () => wallet.removeListener?.("accountsChanged", listener);
}

export async function writeMethod(
  account: string,
  functionName: string,
  args: unknown[],
  value = 0n,
  onStatus?: (status: TxStatus) => void,
): Promise<string> {
  const wallet = provider();
  if (!wallet) throw new Error("Connect an injected wallet before writing.");
  if (String(await wallet.request({ method: "eth_chainId" })).toLowerCase() !== CHAIN_HEX) throw new Error("Switch wallet to GenLayer Studio Dev (61997).");
  const client: any = createClient({ chain, account: account as `0x${string}`, provider: wallet as any });
  onStatus?.({ stage: "SIMULATING", message: "Estimating the GenLayer execution fee." });
  const estimate = await client.estimateTransactionFeesForWrite({ address: requireContract(), functionName, args: args as CalldataEncodable[], value });
  if (!estimate?.distribution || BigInt(estimate.feeValue || 0) <= 0n) throw new Error("Studio Dev returned an unusable fee estimate.");
  onStatus?.({ stage: "AWAITING WALLET", message: "Review and authorize the MatchPay transaction." });
  const hash = String(await client.writeContract({ address: requireContract(), functionName, args: args as CalldataEncodable[], value, fees: { distribution: estimate.distribution, messageAllocations: estimate.messageAllocations, feeValue: estimate.feeValue } }));
  onStatus?.({ stage: "CONSENSUS PENDING", message: "Transaction submitted; waiting for the GenLayer decision.", hash });
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: "decided", interval: 2500, retries: 180, fullTransaction: true });
  if (!isSuccessful(receipt)) throw new Error("GenLayer accepted the transaction but contract execution failed.");
  onStatus?.({ stage: "CONFIRMED", message: "Authoritative contract state updated.", hash });
  return hash;
}
