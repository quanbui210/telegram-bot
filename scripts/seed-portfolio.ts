import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { initDb, seedHoldings, type SeedHolding } from "../src/tools/portfolio";

dotenv.config();

const seedPath =
  process.argv[2] ?? path.join(process.cwd(), "data", "portfolio.seed.json");

if (!fs.existsSync(seedPath)) {
  console.error(`Seed file not found: ${seedPath}`);
  console.error("Copy data/portfolio.seed.example.json → data/portfolio.seed.json");
  process.exit(1);
}

const raw = fs.readFileSync(seedPath, "utf-8");
const holdings = JSON.parse(raw) as SeedHolding[];

initDb();
const count = seedHoldings(holdings);

console.log(`Seeded ${count} holdings from ${seedPath}`);
