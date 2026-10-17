import {test} from "node:test";
import assert from "node:assert/strict";
import {recuperarPdfHistoricoInter} from "../admin-api/src/services/inter-pdf.js";

test("PDF de boleto recebido é recuperado na empresa correta, sem reemitir nem duplicar",async()=>{
 const id="a".repeat(64),row={json:JSON.stringify({cobranca:{codigoSolicitacao:"fake",situacao:"RECEBIDO"}}),etag:"1"};let uploads=0,gets=0;
 const table={async getEntity(p,k){assert.equal(p,"inter-historico-drsoft");assert.equal(k,id);return row;},async updateEntity(e,mode,o){assert.equal(e.partitionKey,"inter-historico-drsoft");assert.equal(mode,"Merge");assert.equal(o.etag,"1");Object.assign(row,e);}};
 const container={getBlockBlobClient(path){assert.equal(path,`historico/drsoft/inter/${id}.pdf`);return {async uploadData(){uploads++;}};}};
 const consultar=async(emp,codigo,pdf)=>{assert.deepEqual([emp,codigo,pdf],["drsoft","fake",true]);gets++;return {pdf:Buffer.from("%PDF-1.4\nDocumento ficticio\n%%EOF").toString("base64")};};
 assert.equal((await recuperarPdfHistoricoInter(table,container,"drsoft",id,consultar)).recuperado,true);
 assert.equal((await recuperarPdfHistoricoInter(table,container,"drsoft",id,consultar)).existente,true);assert.equal(gets,1);assert.equal(uploads,1);
 await assert.rejects(()=>recuperarPdfHistoricoInter(table,container,"invalida",id,consultar));
});

test("PDF inválido não modifica o arquivo nem o histórico",async()=>{
 let write=false;const table={async getEntity(){return {json:JSON.stringify({cobranca:{codigoSolicitacao:"fake"}})};},async updateEntity(){write=true;}};
 const container={getBlockBlobClient(){write=true;throw Error();}};
 await assert.rejects(()=>recuperarPdfHistoricoInter(table,container,"sysney","b".repeat(64),async()=>({pdf:Buffer.from("html erro").toString("base64")})),/PDF válido/);assert.equal(write,false);
});
