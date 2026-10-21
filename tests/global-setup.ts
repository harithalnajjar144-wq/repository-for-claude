import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://halali:halali@localhost:5432/halali_test";
  execSync("npx drizzle-kit migrate", { env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });
}
