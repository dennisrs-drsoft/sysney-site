// Recorte do Swagger SEFIN oficial consultado com mTLS em 27/10/2026.
// Documentos fictícios sem validade fiscal. Nunca encaminha tráfego externo.
const http=require('node:http'),{gzipSync,gunzipSync}=require('node:zlib');
const records=new Map();let mode='normal',posts=0;
function pdf(record){
 const key=mode==='pdf-wrong'?'9'.repeat(50):record.chaveAcesso;
 const content=`BT /F1 10 Tf 20 700 Td (SIMULACAO SEM VALIDADE FISCAL) Tj 0 -20 Td (Chave: ${key}) Tj 0 -20 Td (Numero da NFS-e: ${record.number}) Tj 0 -20 Td (Emitente 57767099000179 Tomador 11222333000181) Tj 0 -20 Td (Valor ${record.amount}) Tj ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(out);
 out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');out+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return out;
}
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local.invalid');
 const send=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(u.pathname==='/qa/mode'){mode=u.searchParams.get('name')||'normal';return send(200,{mode,posts});}
 if(u.pathname==='/qa/stats')return send(200,{posts});
 if(req.method==='GET'&&/^\/danfse\/\d{50}$/.test(u.pathname)){
  const record=[...records.values()].find(r=>r.chaveAcesso===u.pathname.slice(8));if(!record)return send(404,{});
  res.writeHead(200,{'Content-Type':'application/pdf'});return res.end(mode==='pdf-corrupt'?'<html>nao e PDF</html>':pdf(record));
 }
 if(mode==='html'){res.writeHead(500,{'Content-Type':'text/html'});return res.end('<html>Falha sintetica</html>');}
 if(mode==='hang')return setTimeout(()=>send(500,{erro:'Timeout sintetico'}),500);
 const prefix={tipoAmbiente:mode==='wrong-environment'?1:2,versaoAplicativo:'QA-SEM-VALIDADE',dataHoraProcessamento:'2026-10-27T12:00:00-03:00'};
 if(req.method==='POST'&&u.pathname==='/nfse'){
  const chunks=[];for await(const c of req)chunks.push(c);
  let dto,xml;try{dto=JSON.parse(Buffer.concat(chunks));xml=gunzipSync(Buffer.from(dto.dpsXmlGZipB64,'base64')).toString();}catch{return send(400,{...prefix,erros:[{codigo:'QA400',descricao:'DPS invalida'}]});}
  const idDps=xml.match(/Id="(DPS\d+)"/)?.[1];if(!idDps)return send(400,{...prefix,erros:[{codigo:'QAID'}]});
  if(mode==='reject')return send(400,{erros:[{codigo:'E_QA_400',descricao:'Rejeicao sintetica sem validade fiscal'}]});
  posts++;const chaveAcesso=String(posts).padStart(50,'0');
  const number=String(posts),amount=xml.match(/<vServ>([^<]+)/)?.[1]||'0.00';
  const invoice=`<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="NFS${chaveAcesso}"><nNFSe>${number}</nNFSe><dhProc>${new Date().toISOString()}</dhProc><emit><CNPJ>57767099000179</CNPJ></emit>${xml.replace(/<\?xml[^?]*\?>/,'')}</infNFSe></NFSe>`;
  const record={...prefix,idDps,chaveAcesso,number,amount,nfseXmlGZipB64:gzipSync(Buffer.from(invoice)).toString('base64')};records.set(idDps,record);
  if(mode==='timeout-after-commit'){mode='normal';return setTimeout(()=>send(201,record),500);}
  return send(201,record);
 }
 if(req.method==='GET'&&u.pathname.startsWith('/dps/')){const r=records.get(u.pathname.slice(5));return r?send(200,{...r,tipoAmbiente:prefix.tipoAmbiente}):send(404,{...prefix,erro:{codigo:'QA404'}});}
 if(req.method==='GET'&&/^\/nfse\/\d{50}$/.test(u.pathname)){const r=[...records.values()].find(r=>r.chaveAcesso===u.pathname.slice(6));return r?send(200,{...r,tipoAmbiente:prefix.tipoAmbiente}):send(404,{...prefix,erro:{codigo:'QA404'}});}
 if(req.method==='GET'&&/\/eventos\/\d{6}\/\d+$/.test(u.pathname))return send(404,{...prefix,erro:{codigo:'QA_EVENTO_NAO_ENCONTRADO'}});
 return send(501,{erro:'Operacao nao modelada.'});
}).listen(process.env.PORT);
