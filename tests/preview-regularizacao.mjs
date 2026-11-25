// Prévia local: nenhuma API financeira é encaminhada para Azure ou emissores.
import http from 'node:http';
import net from 'node:net';
import {appendFile,mkdir} from 'node:fs/promises';
import {fixture,req as fixtureRequest} from './helpers/regularizacao-emissao-fixture.mjs';

if(process.env.NODE_ENV==='production')throw Error('A prévia sintética não pode executar em produção.');
const host='127.0.0.1',port=3250,targetPort=3249;
function heartbeat(f){for(const key of ['servico|nacional-admin','servico|drserver']){const row=f.table('FiscalFila').rows.get(key);row.em=new Date().toISOString();}}
const states={sysney:fixture('sysney',{assincrono:true}),drsoft:fixture('drsoft')};
process.env.NFSE_NACIONAL_PRODUCAO_HABILITADA='true';
process.env.NFSE_SP_PRODUCAO_HABILITADA='true';process.env.NFSE_SP_VM_PRODUCAO_HABILITADA='true';
await mkdir(new URL('../output/regularizacao-lote-20261125/',import.meta.url),{recursive:true});
for(const [empresa,f] of Object.entries(states)){
  f.recebimentos.forEach((r,index)=>{Object.assign(r,{cliente:empresa==='sysney'?'Cliente Exemplo de Tecnologia Ltda.':'Cliente Exemplo de Serviços e Consultoria Ltda.',centavos:index?147384:2730575,recebimento:index?'2025-02-10':'2025-01-10',competencia:index?'2025-02':'2025-01'});f.row('regularizacao-'+empresa,r.id,r);});
  let l=await f.service.criar(empresa,f.body(),fixtureRequest);
  for(let n=0;n<12&&!l.itens.every(i=>i.status==='pronta');n++)l=await f.service.avancar(empresa,l.id,{modo:'validar',hash:l.hash},fixtureRequest);
  l=await f.service.aprovar(empresa,l.id,{hash:l.hash,confirmado:true},fixtureRequest);
  for(let n=0;n<12&&l.estado!=='concluido';n++)l=await f.service.avancar(empresa,l.id,{modo:'emitir',hash:l.hash},fixtureRequest);
}
const vals=(f,part,name='AdminDocumentos')=>[...f.table(name).rows.values()].filter(r=>r.partitionKey===part).map(r=>JSON.parse(r.json));
const respond=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Sysney-QA':'synthetic-no-fiscal-transmission'});res.end(JSON.stringify(obj));};
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://'+host+':'+port);
  if(url.pathname.startsWith('/api/')){
    await appendFile(new URL('../output/regularizacao-lote-20261125/preview-http.ndjson',import.meta.url),JSON.stringify({time:new Date().toISOString(),method:request.method,path:url.pathname,fixture:true})+'\n');
    const empresa=url.searchParams.get('empresa')||'drsoft',f=states[empresa];if(!f)return respond(response,400,{erro:'Empresa inválida.'});
    try{
      if(url.pathname==='/api/admin/regularizacao-fiscal'){
        heartbeat(f);
        if(request.method==='GET'){
          if(url.searchParams.has('lote'))return respond(response,200,{lote:(await f.service.lote(empresa,url.searchParams.get('lote'))).l});
          const m=await f.service.configuracao(empresa,url.searchParams.get('documento')||undefined);
          return respond(response,200,{lotes:await f.service.listar(empresa),configuracao:{...m,disponivel:true,producaoHabilitada:true,perfil:f.config.perfil||null,fiscal:f.config.fiscal||null,endereco:f.config.endereco||f.config.fiscal?.endereco}});
        }
        let text='';for await(const chunk of request){text+=chunk;if(text.length>20000)return respond(response,413,{erro:'Muito grande.'});}
        const b=JSON.parse(text),l=b.acao==='preparar'?await f.service.criar(empresa,b,fixtureRequest):b.acao==='aprovar'?await f.service.aprovar(empresa,b.loteId,b,fixtureRequest):b.acao==='avancar'?await f.service.avancar(empresa,b.loteId,b,fixtureRequest):b.acao==='organizar-historico'?await f.service.organizarHistorico(empresa,b.loteId,b,fixtureRequest):null;
        if(!l)return respond(response,400,{erro:'Ação inválida.'});return respond(response,200,{lote:l,emailEnviado:false,novaCobrancaCriada:false});
      }
      if(url.pathname==='/api/admin/cobrancas'&&url.searchParams.has('regularizacao')){
        const registros=f.recebimentos.map(r=>JSON.parse(f.table().rows.get(`regularizacao-${empresa}|${r.id}`).json));return respond(response,200,{registros,lotes:[]});
      }
      if(request.method==='GET'&&url.pathname==='/api/admin/clientes')return respond(response,200,{clientes:[]});
      if(request.method==='GET'&&url.pathname==='/api/admin/cobrancas')return respond(response,200,{cobrancas:vals(f,'cobrancas-'+empresa),planos:vals(f,'cobrancas-'+empresa,'AdminConfiguracoes')});
      if(request.method==='GET'&&url.pathname==='/api/admin/historico-inter')return respond(response,200,{cobrancas:[],cobertura:[]});
      if(url.pathname==='/api/admin/emails'){
        if(request.method==='GET')return respond(response,200,{emails:vals(f,'emails-'+empresa),remetente:'financeiro@example.invalid',auditoria:'auditoria@example.invalid'});
        let text='';for await(const chunk of request)text+=chunk;const b=JSON.parse(text),e=vals(f,'emails-'+empresa).find(e=>e.id===b.id||e.id===b.email?.id);if(!e)return respond(response,404,{erro:'Fixture não encontrada.'});
        if(b.acao==='salvar'){Object.assign(e,{para:b.email.para,cc:b.email.cc,assunto:b.email.assunto,atualizadoEm:new Date().toISOString()});}
        else if(b.acao==='conferir-documentos'){e.fluxo.documentos={hash:'fixture',por:'QA sintético',em:new Date().toISOString()};e.atualizadoEm=new Date().toISOString();}
        else if(b.acao==='revisar'){e.status='revisado';e.aprovacaoEnvio={hash:'fixture',por:'QA sintético',em:new Date().toISOString(),remetente:'financeiro@example.invalid'};e.atualizadoEm=new Date().toISOString();}
        else return respond(response,400,{erro:'Envio real bloqueado na prévia sintética.'});f.row('emails-'+empresa,e.id,e);return respond(response,200,{email:e,mensagem:'Fixture local atualizada. Nenhuma chamada externa.'});
      }
      if(request.method==='GET'&&url.pathname==='/api/admin/nfse')return respond(response,200,{notas:[],apuracoes:[]});
      return respond(response,501,{erro:'Rota não prevista na fixture. Nenhuma chamada externa executada.'});
    }catch(e){return respond(response,e.statusCode||400,{erro:e.message});}
  }
  const upstream=http.request({host,port:targetPort,method:request.method,path:request.url,headers:{...request.headers,host:`${host}:${targetPort}`}},res=>{response.writeHead(res.statusCode,res.headers);res.pipe(response);});
  upstream.on('error',()=>{response.writeHead(502);response.end('A prévia Next.js ainda está iniciando.');});request.pipe(upstream);
});
server.on('upgrade',(req,socket,head)=>{
  const upstream=net.connect(targetPort,host,()=>{upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`+Object.entries({...req.headers,host:`${host}:${targetPort}`}).map(([k,v])=>`${k}: ${v}`).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream).pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());
});
server.listen(port,host,()=>console.log(`Prévia sintética em http://${host}:${port}/admin — emissores externos desconectados.`));
