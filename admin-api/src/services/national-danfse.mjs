import {PDFDocument,PDFName,PDFRawStream,PDFArray,PDFDict,PDFString,PDFHexString} from 'pdf-lib';
import {inflateSync,inflateRawSync} from 'node:zlib';
import {digest} from './atp-fiscal-v1.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const textToken=(s,winAnsi=false)=>{const token=s[0]==='<'?PDFHexString.of(s.slice(1,-1)):PDFString.of(s.slice(1,-1));return winAnsi?new TextDecoder('windows-1252',{fatal:true}).decode(token.asBytes()):token.decodeText();};
function boundedFlate(input){
 try{return inflateSync(input,{maxOutputLength:1_000_000});}catch(e){
  // The municipal producer observed offline writes a valid zlib header and
  // COMPLETE raw DEFLATE but omits Adler32. Never accept truncated DEFLATE,
  // bad checksum, dictionaries, extra bytes, unknown filters or unbounded data.
  const b=Buffer.from(input);
  if(e.code!=='Z_BUF_ERROR'||b.length<3||(b[0]&15)!==8||((b[0]<<8)+b[1])%31!==0||(b[1]&32))throw e;
  const r=inflateRawSync(b.subarray(2),{maxOutputLength:1_000_000,info:true});
  if(r.engine.bytesWritten!==b.length-2)throw e;return r.buffer;
 }
}
// Conservative content-stream profile, not a general PDF text engine. Unknown
// CID/CMap/filters/object-streams require review; never guess a document link.
export async function readBoundedPdfText(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<100||bytes.length>5_000_000||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))fail('INVALID_PDF');
 const raw=bytes.toString('latin1').replace(/#([\da-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
 if(/\/Encrypt\b|\/ObjStm\b|\/Type\s*\/XRef\b/.test(raw))fail('PDF_ENCODING_REQUIRES_REVIEW');
 let doc;try{doc=await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});}catch{fail('INVALID_PDF_STRUCTURE');}
 if(doc.isEncrypted||doc.getPageCount()<1||doc.getPageCount()>20)fail('PDF_ENCODING_REQUIRES_REVIEW');
 const seen=new Set();let objects=0;
 function inspect(object,depth=0){
  object=doc.context.lookup(object);if(!object||seen.has(object))return;seen.add(object);
  if(depth>40||++objects>10000)fail('PDF_ENCODING_REQUIRES_REVIEW');
  const dict=object instanceof PDFRawStream?object.dict:object;
  if(typeof dict?.has==='function'&&['JS','JavaScript','OpenAction','AA','EmbeddedFiles','Launch'].some(k=>dict.has(PDFName.of(k))))fail('PDF_ACTIVE_CONTENT');
  if(typeof dict?.get==='function'&&['/JavaScript','/Launch'].includes(String(dict.get(PDFName.of('S')))))fail('PDF_ACTIVE_CONTENT');
  if(dict instanceof PDFDict)for(const [,v] of dict.entries())inspect(v,depth+1);
  if(object instanceof PDFArray)for(const v of object.asArray())inspect(v,depth+1);
 }
 for(const [,object] of doc.context.enumerateIndirectObjects())inspect(object);
 let text='',decodedSize=0;
 for(const page of doc.getPages()){
  let winAnsi=false;
  const resources=page.node.Resources(),fonts=resources?.lookupMaybe(PDFName.of('Font'),PDFDict);
  if(fonts)for(const [,ref] of fonts.entries()){
   const font=doc.context.lookup(ref);if(!(font instanceof PDFDict))fail('PDF_FONT_REQUIRES_REVIEW');
   const subtype=String(font.get(PDFName.of('Subtype'))||''),encoding=String(font.get(PDFName.of('Encoding'))||'');
   if(font.has(PDFName.of('ToUnicode'))||font.has(PDFName.of('DescendantFonts')))fail('PDF_FONT_REQUIRES_REVIEW');
   if(subtype==='/TrueType'&&encoding==='/WinAnsiEncoding'){
    const descriptor=font.lookupMaybe(PDFName.of('FontDescriptor'),PDFDict),flags=Number(String(descriptor?.get(PDFName.of('Flags'))||'0'));
    if(!(flags&32)||flags&4)fail('PDF_FONT_REQUIRES_REVIEW');winAnsi=true;
   }else{
    if(subtype!=='/Type1'||!['','/WinAnsiEncoding','/StandardEncoding'].includes(encoding))fail('PDF_FONT_REQUIRES_REVIEW');
    if(!/^\/(Helvetica|Times-(Roman|Bold|Italic|BoldItalic)|Courier)(-Bold|-Oblique|-BoldOblique)?$/.test(String(font.get(PDFName.of('BaseFont'))||'')))fail('PDF_FONT_REQUIRES_REVIEW');
   }
  }
  const value=page.node.Contents();if(!value)continue;
  const items=value instanceof PDFArray?value.asArray():[value];
  for(const item of items){
   const stream=doc.context.lookup(item);if(!(stream instanceof PDFRawStream))fail('PDF_ENCODING_REQUIRES_REVIEW');
   const filter=stream.dict.get(PDFName.of('Filter')),name=String(filter||'');
   let content;
   try{if(!filter)content=stream.getContents();else if(name==='/FlateDecode')content=boundedFlate(stream.getContents());else fail('PDF_ENCODING_REQUIRES_REVIEW');}catch{fail('PDF_ENCODING_REQUIRES_REVIEW');}
   decodedSize+=content.length;if(decodedSize>5_000_000)fail('PDF_DECODE_LIMIT');
   for(const block of Buffer.from(content).toString('latin1').matchAll(/\bBT\b([\s\S]*?)\bET\b/g)){
    for(const op of block[1].matchAll(/(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]*>)\s*(?:Tj|'|")|\[([^\]]*)\]\s*TJ/g)){
     const tokens=op[1]?[op[1]]:[...op[2].matchAll(/\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]*>/g)].map(m=>m[0]);
     for(const token of tokens)text+=textToken(token,winAnsi);text+=' ';
     if(text.length>100000)fail('PDF_TEXT_LIMIT');
    }
   }
  }
 }
 return {normalized:text.normalize('NFKD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' '),pages:doc.getPageCount()};
}
export async function validateRestrictedDanfse(bytes,evidence){
 if(!/^\d{50}$/.test(evidence?.authorityKey)||!/^\d+$/.test(evidence?.number)||evidence.environment!=='homologacao')fail('PDF_EXPECTED_IDENTITY_REQUIRED');
 const {normalized,pages}=await readBoundedPdfText(bytes),digits=normalized.replace(/\D/g,'');
 const numberMatch=normalized.match(/Numero\s+da\s+NFS[ -]?e\s*:?\s*(\d+)/i);
 const amount=(evidence.amountCentsBRL/100).toFixed(2),brl=amount.replace('.',','),grouped=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(evidence.amountCentsBRL/100);
 if(!digits.includes(evidence.authorityKey)||!digits.includes(evidence.issuerDocument)||!digits.includes(evidence.recipientDocument)||!numberMatch||BigInt(numberMatch[1])!==BigInt(evidence.number)||![brl,amount,grouped].some(a=>normalized.includes(a)))fail('PDF_CONTENT_BINDING_UNVERIFIED');
 return {sha256:digest(bytes),size:bytes.length,authorityKey:evidence.authorityKey,number:evidence.number,pages,contentVerified:true,method:'bounded-content-stream-profile',environment:'homologacao'};
}
