import {readFileSync} from 'node:fs';
import ts from 'typescript';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const info=uri(compile('../../lib/nfse-nacional-info.ts'));
export const nationalModelUri=uri(compile('../../lib/nfse-nacional.ts').replaceAll('"./nfse-nacional-info"',JSON.stringify(info)));
export const nationalModel=await import(nationalModelUri);
