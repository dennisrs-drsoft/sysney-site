import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=ts.transpileModule(readFileSync(new URL("../lib/admin-resposta.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {lerRespostaAdmin}=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("painel preserva JSON e trata HTML, sessão expirada e retorno incompleto sem repetir envio",async()=>{
 assert.deepEqual(await lerRespostaAdmin(Response.json({emails:[]})),{emails:[]});
 assert.deepEqual(await lerRespostaAdmin(Response.json({erro:"Origem não permitida."},{status:403})),{erro:"Origem não permitida."});
 await assert.rejects(lerRespostaAdmin(new Response("<!DOCTYPE html>",{headers:{"content-type":"text/html"}})),/HTTP 200/);
 await assert.rejects(lerRespostaAdmin(new Response("",{status:401}),true),/sessão.*Confira o histórico/);
 const redirected=new Response("<!DOCTYPE html>");Object.defineProperty(redirected,"redirected",{value:true});
 await assert.rejects(lerRespostaAdmin(redirected),/GitHub/);
 await assert.rejects(lerRespostaAdmin(new Response("{",{headers:{"content-type":"application/json"}}),true),/incompleta.*Confira o histórico/);
});
