// Recorte do Swagger SEFIN oficial consultado com mTLS em 27/10/2026.
// Documentos fictícios sem validade fiscal. Nunca encaminha tráfego externo.
const http=require('node:http'),{gzipSync,gunzipSync}=require('node:zlib');
const records=new Map();let mode='normal',posts=0;
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local.invalid');
 const send=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(u.pathname==='/qa/mode'){mode=u.searchParams.get('name')||'normal';return send(200,{mode,posts});}
 if(u.pathname==='/qa/stats')return send(200,{posts});
 if(req.method==='GET'&&/^\/danfse\/\d{50}$/.test(u.pathname)){
  res.writeHead(200,{'Content-Type':'application/pdf'});return res.end(mode==='pdf-corrupt'?'<html>nao e PDF</html>':'%PDF-1.7\nSIMULACAO SEM VALIDADE FISCAL\n%%EOF');
 }
 if(mode==='html'){res.writeHead(500,{'Content-Type':'text/html'});return res.end('<html>Falha sintetica</html>');}
 if(mode==='hang')return setTimeout(()=>send(500,{erro:'Timeout sintetico'}),500);
 const prefix={tipoAmbiente:mode==='wrong-environment'?1:2,versaoAplicativo:'QA-SEM-VALIDADE',dataHoraProcessamento:'2026-10-27T12:00:00-03:00'};
 if(req.method==='POST'&&u.pathname==='/nfse'){
  const chunks=[];for await(const c of req)chunks.push(c);
  let dto,xml;try{dto=JSON.parse(Buffer.concat(chunks));xml=gunzipSync(Buffer.from(dto.dpsXmlGZipB64,'base64')).toString();}catch{return send(400,{...prefix,erros:[{codigo:'QA400',descricao:'DPS invalida'}]});}
  const idDps=xml.match(/Id="(DPS\d+)"/)?.[1];if(!idDps)return send(400,{...prefix,erros:[{codigo:'QAID'}]});
  if(mode==='reject')return send(400,{erros:[{codigo:'E_QA_400',descricao:'Rejeicao sintetica sem validade fiscal'}]});
  posts++;const chaveAcesso=String(records.size+1).padStart(50,'0');
  const record={...prefix,idDps,chaveAcesso,nfseXmlGZipB64:gzipSync(Buffer.from('<NFSeSimulada>SEM VALIDADE FISCAL</NFSeSimulada>')).toString('base64')};records.set(idDps,record);
  if(mode==='timeout-after-commit'){mode='normal';return setTimeout(()=>send(201,record),500);}
  return send(201,record);
 }
 if(req.method==='GET'&&u.pathname.startsWith('/dps/')){const r=records.get(u.pathname.slice(5));return r?send(200,{...r,tipoAmbiente:prefix.tipoAmbiente}):send(404,{...prefix,erro:{codigo:'QA404'}});}
 if(req.method==='GET'&&/^\/nfse\/\d{50}$/.test(u.pathname)){const r=[...records.values()].find(r=>r.chaveAcesso===u.pathname.slice(6));return r?send(200,{...r,tipoAmbiente:prefix.tipoAmbiente}):send(404,{...prefix,erro:{codigo:'QA404'}});}
 if(req.method==='GET'&&/\/eventos\/\d{6}\/\d+$/.test(u.pathname))return send(404,{...prefix,erro:{codigo:'QA_EVENTO_NAO_ENCONTRADO'}});
 return send(501,{erro:'Operacao nao modelada.'});
}).listen(process.env.PORT);
