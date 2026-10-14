import { getDb, schema } from "../src/db";
const db = getDb();
const a = await db.select().from(schema.alerts);
const c = await db.select().from(schema.checkins);
console.log("checkins", c.length, "by risk", c.reduce((m, x) => { m[x.risk ?? "none"] = (m[x.risk ?? "none"] ?? 0) + 1; return m; }, {} as Record<string, number>));
for (const x of a) console.log(`${x.level}: ${x.reasons[0]?.slice(0, 60)} | ${x.escalation.map((s) => `${s.channel}=${s.outcome}`).join(", ")}`);
