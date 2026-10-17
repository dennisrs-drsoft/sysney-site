// Recorte de leitura do contrato público Inter Cobrança v3/Banking v2.
// Dados inteiramente fictícios. Não aceita emissão, cancelamento ou transferência.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- O executor local do Postman carrega handlers CommonJS.
const http=require("node:http");
http.createServer((req,res)=>{
 const url=new URL(req.url,"http://localhost");
 res.setHeader("Content-Type","application/json");
 const send=(code,data)=>{res.statusCode=code;res.end(JSON.stringify(data));};
 if(req.method==="POST"&&url.pathname==="/v2/token")return send(200,{access_token:"token-ficticio",expires_in:3600});
 if(req.method!=="GET")return send(501,{erro:"Operação não modelada; nenhuma escrita permitida neste teste."});
 const cobranca={codigoSolicitacao:"fake-123",valorNominal:100,dataVencimento:"2026-10-10",situacao:"RECEBIDO",pagador:{cpfCnpj:"12345678000100"}};
 if(url.pathname==="/v3/cobrancas")return send(200,{cobrancas:[{cobranca,boleto:{nossoNumero:"123"}}],ultimaPagina:true});
 if(url.pathname==="/v3/cobrancas/fake-123/pdf")return send(200,{pdf:Buffer.from("%PDF-1.4\nDocumento ficticio para simulacao\n%%EOF").toString("base64")});
 if(url.pathname==="/v2/extrato/completo")return send(200,{transacoes:[],totalPaginas:0,ultimaPagina:true});
 return send(501,{erro:"Endpoint não modelado."});
}).listen(process.env.PORT);
