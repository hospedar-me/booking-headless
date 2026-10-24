import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
let failed = false;
for (const f of walk("src").filter(
  (f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"),
)) {
  const text = fs.readFileSync(f, "utf8");
  const ast = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
  for (const n of ast.statements.filter(ts.isImportDeclaration)) {
    const spec = n.moduleSpecifier.text;
    const forbidden =
      spec.startsWith("next") ||
      spec.startsWith("@/") ||
      (f.startsWith("src/core/") && /react|server|browser/.test(spec));
    if (forbidden) {
      console.error(f + ": forbidden dependency " + spec);
      failed = true;
    }
  }
  if (
    f.startsWith("src/core/") &&
    /window\.|document\.|process\.env|className/.test(text)
  ) {
    console.error(f + ": core contains environment or UI access");
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("Module boundaries passed.");
