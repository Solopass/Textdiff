#!/usr/bin/env node
/**
 * Deletes expired shared diffs.
 *
 * The client refuses to render an expired document, but that only hides it —
 * the data is still in Firestore and still readable by anyone who bypasses the
 * app. This job is what actually removes it.
 *
 * Firestore security rules deny deletes to every client. This script uses the
 * Admin SDK, which bypasses rules, so it must run somewhere trusted with a
 * service account — never in the browser.
 *
 * Usage:
 *
 *   npm install firebase-admin          # not a project dependency; see below
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   node scripts/cleanup-expired-shares.mjs [--dry-run]
 *
 * `firebase-admin` is deliberately NOT in package.json. It is a server-only
 * package with a large dependency tree, and adding it would put it in the
 * install path of everyone building the frontend. Install it ad hoc wherever
 * this job runs.
 *
 * Scheduling: any cron-like trigger works — GitHub Actions on a schedule,
 * Cloud Scheduler, or a plain crontab. Daily is plenty for a 30-day TTL.
 *
 * Requires a Firestore index on `expiresAt` (single-field indexes are created
 * automatically, so this normally needs no action).
 */

import { readFileSync } from "node:fs";

const DRY_RUN = process.argv.includes("--dry-run");
// Firestore caps writes at 500 operations per batch.
const BATCH_SIZE = 400;

const projectId = JSON.parse(
  readFileSync(new URL("../firebase-applet-config.json", import.meta.url), "utf8"),
).projectId;

const { initializeApp, applicationDefault } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it at a service account\n" +
      "JSON file with Firestore write access to project " +
      projectId +
      ".",
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const now = Date.now();
let totalDeleted = 0;
let totalScanned = 0;

console.log(
  `${DRY_RUN ? "[dry run] " : ""}Removing shares with expiresAt < ${new Date(now).toISOString()}`,
);

// Page through rather than loading the whole collection: it can be large, and
// deleting while iterating a single snapshot is fragile.
for (;;) {
  const snapshot = await db
    .collection("diffs")
    .where("expiresAt", "<", now)
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) break;
  totalScanned += snapshot.size;

  if (DRY_RUN) {
    for (const doc of snapshot.docs) {
      console.log(`  would delete ${doc.id} (expired ${new Date(doc.get("expiresAt")).toISOString()})`);
    }
    // Nothing is deleted, so the same page would come back forever.
    break;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  totalDeleted += snapshot.size;
  console.log(`  deleted ${snapshot.size} (running total ${totalDeleted})`);

  // A short page means we've reached the end.
  if (snapshot.size < BATCH_SIZE) break;
}

console.log(
  DRY_RUN
    ? `[dry run] ${totalScanned} document(s) would be deleted.`
    : `Done. Deleted ${totalDeleted} expired share(s).`,
);

// Documents predating the expiry field have no `expiresAt` and are invisible
// to the query above, so they are never removed by this job. If you want them
// gone, delete them once by hand — they are all older than the date expiry
// shipped.
process.exit(0);
