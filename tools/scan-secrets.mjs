import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const ignoredDirs = new Set([".git", "node_modules", "dist", ".vite", "docker-data"]);
const maxFileSize = 2 * 1024 * 1024;
const findings = [];

const patterns = [
  { name: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/i, severity: "high" },
  { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/, severity: "high" },
  { name: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{24,}/i, severity: "high" },
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, severity: "high" },
  { name: "aws-key", pattern: /\bAKIA[0-9A-Z]{16}\b/, severity: "high" },
  {
    name: "password-assignment",
    pattern: /\b(?:password|passwd|pwd|secret|token|cookie|authorization|api[_-]?key)\b\s*[:=]\s*["']?(?!\[redacted\]|replace-|your-|example|localhost|local-dev|sstl_ai)[^\s"',}{]{8,}/i,
    severity: "medium"
  }
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = fs.statSync(fullPath);
    if (stat.size > maxFileSize) continue;
    const buffer = fs.readFileSync(fullPath);
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");
    for (const { name, pattern, severity } of patterns) {
      const match = text.match(pattern);
      if (match) {
        if (isAllowedReference(match[0])) continue;
        findings.push({
          file: path.relative(root, fullPath),
          pattern: name,
          severity,
          sample: match[0].slice(0, 80)
        });
      }
    }
  }
}

function isAllowedReference(sample) {
  return (
    sample.includes("process.env") ||
    sample.includes("env.") ||
    sample.includes(".password") ||
    sample.includes("a.password") ||
    sample.includes("SSTL_PASSWORD") ||
    sample.includes("SSTL_DB_PASSWORD")
  );
}

walk(root);

if (findings.length) {
  console.error("Secret scan found potential sensitive values:");
  for (const finding of findings) {
    console.error(`${finding.severity.toUpperCase()} ${finding.pattern} ${finding.file}: ${finding.sample}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");
