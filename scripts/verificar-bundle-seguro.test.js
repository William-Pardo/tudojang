import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteSource = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "coverage",
  "dist",
  ".firebase",
]);
const readRepositorySources = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name)
        ? []
        : readRepositorySources(entryPath);
    }
    return /\.(?:[cm]?[jt]sx?|txt|md|json)$/.test(entry.name)
      ? [fs.readFileSync(entryPath, "utf8")]
      : [];
  });
const securitySensitiveSources = readRepositorySources(root).join("\n");

test("Vite never injects Gemini or generic AI keys into browser code", () => {
  assert.doesNotMatch(viteSource, /GEMINI_API_KEY/);
  assert.doesNotMatch(viteSource, /process\.env\.API_KEY/);
});

test("repository contains no Wompi private, event, or integrity credentials", () => {
  assert.doesNotMatch(
    securitySensitiveSources,
    /\b(?:prv_(?:prod|test)|(?:prod|test)_(?:events|integrity))_[A-Za-z0-9_-]+\b/
  );
});

// Agregado 2026-07-22 tras encontrar un Personal Access Token de GitHub embebido en texto
// plano en la URL del remoto (`.git/config`).
//
// ALCANCE, para no crear falsa sensacion de seguridad: este test cubre los FUENTES DEL
// REPOSITORIO, no `.git/config` -- ese archivo no esta versionado y varia por clone, asi que
// un test de contenido no puede vigilarlo. O sea, NO habria detectado aquel hallazgo. Lo que
// si evita es el modo de falla adyacente y mas grave: que un token quede commiteado en un
// archivo del repo, donde vive para siempre en el historial aunque despues se borre.
test("repository contains no GitHub personal access tokens", () => {
  // Prefijos oficiales de GitHub: ghp_ (classic), gho_ (OAuth), ghu_/ghs_ (app),
  // ghr_ (refresh), github_pat_ (fine-grained).
  assert.doesNotMatch(
    securitySensitiveSources,
    /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/
  );
});

test("operational scripts do not hardcode Firebase web API keys", () => {
  const scripts = path.join(root, "scripts");
  const scriptSources = fs
    .readdirSync(scripts, { recursive: true })
    .filter((file) => /\.(?:cjs|mjs|js)$/.test(file))
    .map((file) => fs.readFileSync(path.join(scripts, file), "utf8"))
    .join("\n");

  assert.doesNotMatch(scriptSources, /AIza[0-9A-Za-z_-]{20,}/);
});

test("production bundle contains no backend AI secrets or quota constants", () => {
  const dist = path.join(root, "dist");
  assert.equal(fs.existsSync(dist), true, "run npm run build before this test");

  const files = fs
    .readdirSync(dist, { recursive: true })
    .filter((file) => /\.(?:js|css|html|json)$/.test(file));
  const bundle = files
    .map((file) => fs.readFileSync(path.join(dist, file), "utf8"))
    .join("\n");

  assert.doesNotMatch(bundle, /GEMINI_API_KEY|ASSISTANT_AI_ENABLED/);
  assert.doesNotMatch(
    bundle,
    /LIMITES_IA|RESERVA_IA_MICROS|inputUsdPerMillion|outputUsdPerMillion/
  );
  assert.doesNotMatch(bundle, /process\.env\.API_KEY|GoogleGenerativeAI|GoogleGenAI/);
  assert.doesNotMatch(
    bundle,
    /\b(?:prv_(?:prod|test)|(?:prod|test)_(?:events|integrity))_[A-Za-z0-9_-]+\b/
  );
});
