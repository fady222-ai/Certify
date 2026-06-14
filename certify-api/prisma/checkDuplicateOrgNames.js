// Maintenance: detect (and optionally fix) duplicate academy names so the
// case-insensitive unique index on organizations(lower(name)) can be created.
//
//   node prisma/checkDuplicateOrgNames.js          # report only (read-only)
//   node prisma/checkDuplicateOrgNames.js --fix     # keep oldest, rename newer
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIX = process.argv.includes("--fix");
const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, createdAt: true, owner: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map();
  for (const o of orgs) {
    const k = norm(o.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }
  const dups = [...groups.values()].filter((g) => g.length > 1);

  if (dups.length === 0) {
    console.log("✅ No duplicate academy names.");
    return;
  }

  console.log(`Found ${dups.length} duplicated name group(s):\n`);
  for (const g of dups) {
    console.log(`• "${g[0].name}" ×${g.length}`);
    g.forEach((o, i) =>
      console.log(`    [${i === 0 ? "keep" : "dup "}] ${o.id} | ${o.name} | ${o.owner?.email ?? "-"} | ${o.createdAt.toISOString().slice(0, 10)}`),
    );
  }

  if (!FIX) {
    console.log(`\nRun again with --fix to rename the newer duplicates (the oldest in each group is kept).`);
    return;
  }

  const taken = new Set([...groups.keys()]);
  let renamed = 0;
  for (const g of dups) {
    for (let i = 1; i < g.length; i++) {
      let n = i + 1;
      let candidate;
      do { candidate = `${g[i].name} (${n})`; n++; } while (taken.has(norm(candidate)));
      taken.add(norm(candidate));
      await prisma.organization.update({ where: { id: g[i].id }, data: { name: candidate } });
      renamed++;
      console.log(`renamed ${g[i].id} → "${candidate}"`);
    }
  }
  console.log(`\n✅ Renamed ${renamed} organization(s). Restart the server to create the unique index.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
