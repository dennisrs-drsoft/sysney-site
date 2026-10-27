import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts,PDFName,PDFString} from 'pdf-lib';
import {validateRestrictedDanfse} from '../admin-api/src/services/national-danfse.mjs';
const expected={authorityKey:'1'.repeat(50),number:'53',issuerDocument:'57767099000179',recipientDocument:'11222333000181',amountCentsBRL:19900,environment:'homologacao'};
async function makePdf({key=expected.authorityKey,number='53',recipient=expected.recipientDocument,amount='199,00',customFont=false,active=false,metadataOnly=false,objectStreams=false}={}){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([600,800]);
 if(metadataOnly)doc.setSubject(key);
 page.drawText(`SIMULACAO SEM VALIDADE FISCAL\nChave ${metadataOnly?'outra':key}\nNumero da NFS-e: ${number}\nEmitente ${expected.issuerDocument}\nTomador ${recipient}\nValor ${amount}`,{x:10,y:700,size:9,font});
 if(customFont){await font.embed();const f=doc.context.lookup(font.ref);if(customFont==='cid')f.set(PDFName.of('Subtype'),PDFName.of('Type0'));else f.set(PDFName.of('ToUnicode'),doc.context.flateStream('begincmap endcmap'));}
 if(active)doc.catalog.set(PDFName.of('OpenAction'),doc.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('alert(1)')}));
 return Buffer.from(await doc.save({useObjectStreams:objectStreams}));
}
test('DANFSe exige PDF real, texto vinculado a chave/numero/tomador/valor e bytes',async()=>{
 const bytes=await makePdf(),proof=await validateRestrictedDanfse(bytes,expected);assert.equal(proof.contentVerified,true);assert.equal(proof.authorityKey,expected.authorityKey);assert.equal(proof.size,bytes.length);assert.equal(proof.sha256.length,64);
 for(const option of [{key:'2'.repeat(50)},{number:'54'},{recipient:'27381256000142'},{amount:'198,00'},{metadataOnly:true}])await assert.rejects(validateRestrictedDanfse(await makePdf(option),expected),{code:'PDF_CONTENT_BINDING_UNVERIFIED'});
 await assert.rejects(validateRestrictedDanfse(Buffer.from('%PDF-1.7\nNAO E PDF\n%%EOF'),expected),{code:'INVALID_PDF'});
});
test('DANFSe desconhecido/CMap/objetos comprimidos/ativo falha fechado em revisão',async()=>{
 await assert.rejects(validateRestrictedDanfse(await makePdf({customFont:true}),expected),{code:'PDF_FONT_REQUIRES_REVIEW'});
 await assert.rejects(validateRestrictedDanfse(await makePdf({customFont:'cid'}),expected),{code:'PDF_FONT_REQUIRES_REVIEW'});
 await assert.rejects(validateRestrictedDanfse(await makePdf({objectStreams:true}),expected),{code:'PDF_ENCODING_REQUIRES_REVIEW'});
 await assert.rejects(validateRestrictedDanfse(await makePdf({active:true}),expected),{code:'PDF_ACTIVE_CONTENT'});
 await assert.rejects(validateRestrictedDanfse(await makePdf(),{...expected,environment:'production'}),{code:'PDF_EXPECTED_IDENTITY_REQUIRED'});
});
