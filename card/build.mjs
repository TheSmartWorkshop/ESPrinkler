// Bundles the ESPrinkler card into dist/esprinkler-card.js (a single Lovelace resource).
import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/esprinkler-card.ts"],
  bundle: true,
  format: "esm",
  target: "es2021",
  outfile: "dist/esprinkler-card.js",
  sourcemap: false,
  minify: true,
  legalComments: "none",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching…");
} else {
  await build(options);
  console.log("built dist/esprinkler-card.js");
}
