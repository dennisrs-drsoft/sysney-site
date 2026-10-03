import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../",import.meta.url));
await mkdir(resolve(root,"admin-api/generated"),{recursive:true});
await mkdir(resolve(root,"admin-api/public"),{recursive:true});
await copyFile(resolve(root,"public/logo.png"),resolve(root,"admin-api/public/logo.png"));
for(const name of ["clientes","cobrancas","emails","aprovacoes","historico-inter","status","documentos"]){
  await build({absWorkingDir:root,entryPoints:[`app/api/admin/${name}/route.ts`],outfile:`admin-api/generated/${name}.mjs`,bundle:true,platform:"node",format:"esm",target:"node22",packages:"external",alias:{"next/server":resolve(root,"admin-api/src/compat/next-server.mjs")},tsconfig:"tsconfig.json"});
}
console.log("API administrativa compilada a partir dos mesmos handlers do site.");
