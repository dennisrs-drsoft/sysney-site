// Build only. Never uploads, registers a worker, grants access or transmits.
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('output',{recursive:true});
await build({entryPoints:['admin-api/scripts/atp-municipal.mjs'],outfile:'output/atp-municipal-runner.mjs',bundle:true,platform:'node',format:'esm',target:'node22',minify:true,banner:{js:"import {createRequire as __runtimeCreateRequire} from 'node:module'; const require=__runtimeCreateRequire(import.meta.url);"}});
const bytes=await readFile('output/atp-municipal-runner.mjs'),metadata={target:'node22',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),transmitted:false,installed:false};
await writeFile('output/atp-municipal-runner.manifest.json',JSON.stringify(metadata,null,2));console.log(JSON.stringify(metadata));
