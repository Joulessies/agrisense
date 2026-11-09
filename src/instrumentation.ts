export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const globalState = globalThis as typeof globalThis & { __agrisenseLiveAlerts?: boolean };
  if (globalState.__agrisenseLiveAlerts) return;
  globalState.__agrisenseLiveAlerts = true;
  const { startLiveAlertWatcher } = await import("./services/liveAlertWatcher");
  startLiveAlertWatcher();
}
