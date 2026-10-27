import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {TableClient,TableServiceClient} from '@azure/data-tables';
import {BlobServiceClient} from '@azure/storage-blob';
import {createAtpFiscalRepository,createAtpFiscalEmulatorStore} from '../admin-api/src/services/atp-fiscal-store.mjs';
import {digest} from '../admin-api/src/services/atp-fiscal-v1.mjs';

test('Azurite isolado: transacao, ETag, unicidade, documentos privados e hash', {skip:!process.env.ATP_AZURITE_PACKAGE,timeout:90000},async()=>{
 const packagePath=process.env.ATP_AZURITE_PACKAGE;
 const constants=await import(pathToFileURL(packagePath+'/dist/src/common/utils/constants.js').href);
 const {EMULATOR_ACCOUNT_NAME:name,EMULATOR_ACCOUNT_KEY:key}=constants;
 assert.equal(name,'devstoreaccount1');
 const connection=`DefaultEndpointsProtocol=http;AccountName=${name};AccountKey=${Buffer.from(key).toString('base64')};BlobEndpoint=http://127.0.0.1:11000/${name};TableEndpoint=http://127.0.0.1:11002/${name};`;
 // Nenhum endpoint remoto pode entrar pelo helper de emulação.
 assert.throws(()=>createAtpFiscalEmulatorStore(connection.replace('127.0.0.1:11000','azure.example:11000')));
 const suffix=randomUUID().replaceAll('-',''),tableName='AtpFiscalQa'+suffix,containerName='atpfiscalqa'+suffix;
 assert.match(tableName,/^AtpFiscalQa[a-f0-9]{32}$/);assert.match(containerName,/^atpfiscalqa[a-f0-9]{32}$/);
 const service=TableServiceClient.fromConnectionString(connection,{allowInsecureConnection:true});
 const table=TableClient.fromConnectionString(connection,tableName,{allowInsecureConnection:true});
 const blobs=BlobServiceClient.fromConnectionString(connection),container=blobs.getContainerClient(containerName);
 let tableCreated=false,containerCreated=false;
 try{
  await service.createTable(tableName);tableCreated=true;await container.create();containerCreated=true;
  const repo=createAtpFiscalRepository({table,blobs:{getContainerClient:n=>{assert.equal(n,'admin-anexos');return container;}}});
  const make=(id,ref)=>({id,source:'ATP',input:{paymentId:id,externalReference:ref,amountCentsBRL:100,competence:'2026-10'},hash:digest(id),status:'pending_review',reviewStatus:'none',createdAtUtc:'2026-10-27T12:00:00Z',updatedAtUtc:'2026-10-27T12:00:00Z'});
  const one=make('a'.repeat(64),'QA:ONE'),two=make('b'.repeat(64),'QA:ONE');
  await repo.create(one);assert.equal((await repo.byReference('QA:ONE')).id,one.id);
  await assert.rejects(repo.create(two));assert.equal(await repo.get(two.id),null); // rollback do insert antes de índice conflitante
  const initial=await repo.get(one.id);
  await repo.replace({...initial,reviewStatus:'refund_review_required'},initial.etag);
  await assert.rejects(repo.replace({...initial,status:'issued'},initial.etag)); // ETag obsoleto
  assert.equal((await repo.get(one.id)).reviewStatus,'refund_review_required');
  const three=make('c'.repeat(64),'QA:THREE');
  const concurrent=await Promise.allSettled([repo.create(three),repo.create(three)]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);
  const p={workId:'d'.repeat(64),requestId:three.id,source:'ATP',snapshotHash:digest('snapshot')};
  await repo.reserveProvenance(p);await assert.rejects(repo.reserveProvenance({...p,workId:'e'.repeat(64)}));assert.equal(await repo.getProvenance('e'.repeat(64)),null);
  const xml=Buffer.from('<NFSeSimulada>SEM VALIDADE FISCAL</NFSeSimulada>'),file=await repo.saveOfficialDocument(three.id,'xml',xml,digest(xml));
  const same=await repo.saveOfficialDocument(three.id,'xml',xml,digest(xml));assert.deepEqual(same,file);
  const current=await repo.get(three.id),proof=await repo.getProvenance(p.workId),approvalHash=digest('approval'),invoiceIdentity=digest('invoice');
  const updated={...current,status:'issued',invoice:{number:'SINTETICA',issuerDocument:'57767099000179',provider:'national'},linkApprovalHash:approvalHash,documents:{xml:file}};
  const commit={request:updated,requestEtag:current.etag,provenance:proof,claim:{invoiceIdentity,requestId:three.id,approvalHash},audit:{actorId:'QA-SINTETICO',approvalHash}};
  await repo.commitLink(commit);assert.equal((await repo.get(three.id)).status,'issued');assert.equal((await repo.getInvoiceClaim(invoiceIdentity)).requestId,three.id);
  assert.deepEqual(await repo.download(updated,'xml'),xml);
  const anonymous=await fetch(`http://127.0.0.1:11000/${name}/${containerName}/${file.blob}`,{signal:AbortSignal.timeout(3000)});
  assert.equal(anonymous.status,403);await anonymous.body?.cancel();
  await assert.rejects(repo.download({...updated,documents:{xml:{...file,blob:'sysney/fora-do-escopo.xml'}}},'xml'));
  const claimBefore=await repo.getInvoiceClaim(invoiceIdentity);await assert.rejects(repo.commitLink(commit));assert.deepEqual(await repo.getInvoiceClaim(invoiceIdentity),claimBefore);
  // Mutação explícita apenas do objeto QA para comprovar detecção de adulteração.
  await container.getBlockBlobClient(file.blob).uploadData(Buffer.from('<NFSeSimulada>ALTERADO</NFSeSimulada>'));
  await assert.rejects(repo.download(updated,'xml'));
  const property=await container.getProperties();assert.equal(property.blobPublicAccess,undefined);
 }finally{
  // Remoção só dos dois nomes recém-gerados, validados e criados por este teste.
  if(containerCreated){assert.match(containerName,/^atpfiscalqa[a-f0-9]{32}$/);await container.delete();}
  if(tableCreated){assert.match(tableName,/^AtpFiscalQa[a-f0-9]{32}$/);await service.deleteTable(tableName);}
 }
});
