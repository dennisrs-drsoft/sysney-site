import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {empacotarTabela,verificarTabela} from "../admin-api/src/services/backup-financeiro.mjs";
test("backup sintético restaura registros e detecta truncamento, alteração e repetição",()=>{
 const entidades=[{partitionKey:"fake",rowKey:"1",json:'{"valor":100}',etag:"antigo",timestamp:"ontem"},{partitionKey:"fake",rowKey:"2",json:'{"valor":200}'}];
 const {conteudo,registro}=empacotarTabela("AdminDocumentos",entidades);
 assert.equal(verificarTabela(registro,conteudo).length,2);assert.equal(verificarTabela(registro,conteudo)[0].etag,undefined);
 assert.throws(()=>verificarTabela(registro,conteudo.subarray(1)),/incompleto/);
 assert.throws(()=>verificarTabela({...registro,arquivo:"../arquivo"},conteudo),/incompleto/);
 const duplicado=empacotarTabela("AdminDocumentos",[entidades[0],entidades[0]]);assert.throws(()=>verificarTabela(duplicado.registro,duplicado.conteudo),/repetidas/);
 assert.throws(()=>empacotarTabela("Segredos",entidades),/não permitida/);
});
test("restauro operacional exige destino separado, contêiner privado e só cria tabelas isoladas",()=>{
 const script=readFileSync(new URL("../admin-api/scripts/backup-financeiro.mjs",import.meta.url),"utf8");
 assert.match(script,/destino===origem/);assert.match(script,/blobPublicAccess/);assert.match(script,/Restauro/);
 assert.doesNotMatch(script,/\.deleteEntity\(|\.upsertEntity\(|\.updateEntity\(|\.deleteTable\(/);
});
