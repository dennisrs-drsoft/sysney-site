import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const tabela=uri(`export class TableClient {async getEntity(p){const m=globalThis.filaFiscalMock;return p==='servico'?m.saude:m.resultado;}async createEntity(e){globalThis.filaFiscalMock.criados.push(e);globalThis.filaFiscalMock.resultado.hash=e.hash;}}`);
const cred=uri('export class DefaultAzureCredential {}');
const source=ts.transpileModule(readFileSync(new URL('../lib/nfse-sp-fila.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll('"@azure/data-tables"',JSON.stringify(tabela)).replaceAll('"@azure/identity"',JSON.stringify(cred));
const {executarNaVM,validarEntradaVM}=await import(uri(source));
const entrada={acao:'testar',cnpj:'12345678000199',xml:'<teste/>',cadeia:'teste'};
test('fila fiscal recusa emissão e saúde vencida/inválida antes de criar pedido',async()=>{
 assert.throws(()=>validarEntradaVM({...entrada,acao:'emitir'}));
 assert.throws(()=>validarEntradaVM({...entrada,xml:'x'.repeat(24001)}));
 for(const em of ['inválida','2000-01-01T00:00:00Z',new Date(Date.now()+60000).toISOString()]){
  globalThis.filaFiscalMock={saude:{modo:'teste',em},criados:[]};
  await assert.rejects(executarNaVM(entrada),/indisponível/);
  assert.equal(globalThis.filaFiscalMock.criados.length,0);
 }
});
test('fila fiscal devolve teste confirmado e não repete pedido em falha',async()=>{
 const retorno={sucesso:true,teste:true,xml:'<retorno/>',erros:[],alertas:[]};
 globalThis.filaFiscalMock={saude:{modo:'teste',em:new Date().toISOString()},criados:[],resultado:{estado:'concluido',resultado:JSON.stringify(retorno)}};
 assert.deepEqual(await executarNaVM(entrada),retorno);
 assert.equal(globalThis.filaFiscalMock.criados.length,1);
 globalThis.filaFiscalMock.resultado.resultado=JSON.stringify({...retorno,teste:false});
 await assert.rejects(executarNaVM(entrada),/não confirmado/);
 assert.equal(globalThis.filaFiscalMock.criados.length,2);
});
test('worker e assinador possuem bloqueios independentes de produção',()=>{
 const worker=readFileSync(new URL('../admin-api/scripts/fiscal-vm-worker.ps1',import.meta.url),'utf8');
 const signer=readFileSync(new URL('../admin-api/scripts/executar-nfse-sp.ps1',import.meta.url),'utf8');
 assert.match(worker,/\$pedido\.acao -notin @\('testar','consultar'\)/);
 assert.match(worker,/NFSE_SP_PRODUCAO_HABILITADA'\]='false'/);
 assert.match(worker,/NFSE_SP_CERT_STORE'\]='LocalMachine'/);
 assert.match(signer,/NFSE_SP_SOMENTE_TESTE -eq 'true' -and \$entrada\.acao -eq 'emitir'/);
 assert.match(signer,/Thumbprint -eq \$thumb/);
 // A operação de teste usa a action publicada no WSDL, não o nome do método.
 assert.match(signer,/'TesteEnvioLoteRPSRequest','testeenvio'/);
});
