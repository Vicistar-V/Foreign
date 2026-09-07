// Lightweight event bus so components outside MachinesCard (e.g. WalletCard's
// "Add Spots" button) can trigger the same buy-spot flow — which routes to
// BuySpotDrawer when the wallet has funds, or DepositModal when it doesn't —
// instead of forcing users straight into a bank payment.

const listeners = new Set<() => void>();

export function requestBuySpot() {
  listeners.forEach((l) => l());
}

export function subscribeBuySpotRequests(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
