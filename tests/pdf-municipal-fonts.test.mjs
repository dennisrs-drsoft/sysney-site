import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,PDFName} from 'pdf-lib';
import {deflateSync} from 'node:zlib';
import {readBoundedPdfText} from '../admin-api/src/services/national-danfse.mjs';
async function fixture({corrupt=false,truncated=false,font='WinAnsiEncoding'}={}){
 const doc=await PDFDocument.create(),page=doc.addPage(),descriptor=doc.context.obj({Type:'FontDescriptor',Flags:32,FontName:'Roboto',Ascent:900,Descent:-200,CapHeight:700,StemV:80,ItalicAngle:0,FontBBox:[0,-200,1000,900]});
 const f=doc.context.obj({Type:'Font',Subtype:'TrueType',BaseFont:'Roboto',Encoding:font,FontDescriptor:descriptor});page.node.set(PDFName.of('Resources'),doc.context.obj({Font:{F1:f}}));
 let compressed=deflateSync(Buffer.from('BT /F1 12 Tf (Numero da Nota 49 Codigo de Verificacao QA123456) Tj ET'));
 if(corrupt){compressed=Buffer.from(compressed);compressed[compressed.length-1]^=1;}else compressed=compressed.subarray(0,compressed.length-4);
 if(truncated)compressed=compressed.subarray(0,compressed.length-2);
 const stream=doc.context.stream(compressed,{Filter:'FlateDecode'});page.node.set(PDFName.of('Contents'),doc.context.register(stream));return Buffer.from(await doc.save({useObjectStreams:false}));
}
test('perfil municipal TrueType WinAnsi aceita DEFLATE completo sem Adler, sem relaxar dados truncados/corrompidos',async()=>{
 const r=await readBoundedPdfText(await fixture());assert.match(r.normalized,/Numero da Nota 49/);
 await assert.rejects(readBoundedPdfText(await fixture({corrupt:true})),/ENCODING/);await assert.rejects(readBoundedPdfText(await fixture({truncated:true})),/ENCODING/);await assert.rejects(readBoundedPdfText(await fixture({font:'Identity-H'})),/FONT/);
});
