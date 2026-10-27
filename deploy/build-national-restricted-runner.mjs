// Build-only artifact: never uploads, installs, changes configuration or transmits.
// Place the resulting bundle under admin-api/src/services in the isolated candidate
// so the native signer/transport resolves ../../scripts relative to import.meta.url.
import {build} from 'esbuild';
import {gzipSync} from 'node:zlib';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir('output',{recursive:true});
await build({entryPoints:['admin-api/scripts/nacional-restrita.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',minify:true,legalComments:'inline',banner:{js:"import {createRequire as __runtimeCreateRequire} from 'node:module'; const require=__runtimeCreateRequire(import.meta.url);"},outfile:'output/nacional-restrita-runner.mjs'});
const bytes=await readFile('output/nacional-restrita-runner.mjs'),compressed=gzipSync(bytes);
await writeFile('output/nacional-restrita-runner.mjs.gz',compressed);
const metadata={target:'node22',bundleBytes:bytes.length,bundleSha256:sha(bytes),gzipBytes:compressed.length,dependencies:Object.fromEntries(['@azure/data-tables','@azure/identity','@azure/storage-blob'].map(n=>[n,require(n+'/package.json').version])),transmitted:false};
await writeFile('output/nacional-restrita-runner.manifest.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));
