import type { CallProvider } from "./provider";
import { FakeCalleProvider } from "./fake";
import { LiveCalleProvider } from "./live";

let fake: FakeCalleProvider | null = null;

export function getProvider(mode?: "dry" | "live"): CallProvider {
  const m = mode ?? ((process.env.NIGHTINGALE_MODE === "live" ? "live" : "dry") as "dry" | "live");
  if (m === "live") {
    const key = process.env.CALLE_API_KEY;
    if (!key) throw new Error("CALLE_API_KEY is required in live mode");
    return new LiveCalleProvider(key);
  }
  if (!fake) fake = new FakeCalleProvider();
  return fake;
}
