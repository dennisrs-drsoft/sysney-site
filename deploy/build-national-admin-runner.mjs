// Build only; no upload, VM changes or fiscal communication.
import {build} from 'esbuild';
import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root='output/nacional-admin-package';await mkdir(root,{recursive:true});
await build({entryPoints:['admin-api/scripts/nacional-admin-worker.mjs'],outfile:join(root,'national-admin-runner.mjs'),bundle:true,platform:'node',format:'esm',target:'node22',minify:true,banner:{js:"import {createRequire as __runtimeCreateRequire} from 'node:module';const require=__runtimeCreateRequire(import.meta.url);"}});
const files=['national-admin-runner.mjs'];
await copyFile('admin-api/scripts/iniciar-nacional-admin.ps1',join(root,'iniciar-nacional-admin.ps1'));files.push('iniciar-nacional-admin.ps1');
for(const name of ['nacional-admin-native.ps1','assinar-dps-nacional.ps1','assinar-dps-restrita.ps1']){const dest=join(root,'admin-api/scripts',name);await mkdir(join(root,'admin-api/scripts'),{recursive:true});await copyFile('admin-api/scripts/'+name,dest);files.push('admin-api/scripts/'+name);}
for(const dir of ['nfse-nacional-producao','nfse-nacional-restrita']){
 const path='admin-api/schemas/'+dir;await mkdir(join(root,path),{recursive:true});
 for(const name of (await readdir(path)).filter(n=>n.endsWith('.xsd'))){await copyFile(join(path,name),join(root,path,name));files.push(path+'/'+name);}
}
const manifest={version:1,createdAt:new Date().toISOString(),files:[]};
for(const path of files){const b=await readFile(join(root,path));manifest.files.push({path,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length});}
await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({package:root,files:files.length,runnerSha256:manifest.files[0].sha256,transmitted:false,installed:false}));
