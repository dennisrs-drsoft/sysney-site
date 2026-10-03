import {readFileSync,readdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
// Harness de componente: DOM e hooks controlados, sem navegador, rede ou ações financeiras.
const uri=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const react=uri(`export const h={slots:[],cursor:0,effects:[],reset(){this.cursor=0;this.effects=[]},clear(){this.slots=[];this.reset()}};
export const useRef=v=>{const i=h.cursor++;return h.slots[i]??(h.slots[i]={current:v})};
export const useState=v=>{const i=h.cursor++;if(!(i in h.slots))h.slots[i]=v;return [h.slots[i],n=>{h.slots[i]=typeof n==='function'?n(h.slots[i]):n}]};
export const useEffect=f=>h.effects.push(f);export const useId=()=> 'modal-teste';export const useCallback=f=>f;
export const useSyncExternalStore=(s,c)=>c();export const createContext=()=>({Provider:'Provider'});export const useContext=c=>c.value;
`);
const jsx=uri(`export const Fragment='Fragment';export const jsx=(type,props)=>{if(type==='dialog'&&props.ref)props.ref.current=globalThis.domDialog;if(type==='button'&&props.ref)props.ref.current=globalThis.domButton;return {type,props}};export const jsxs=jsx;`);
let code=ts.transpileModule(readFileSync(new URL('../app/admin/dialogos-admin.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const [name,target] of Object.entries({'react':react,'react/jsx-runtime':jsx,'react-dom':uri('export const createPortal=x=>x;'),'./dialogos-admin.module.css':uri('export default new Proxy({}, {get:(t,k)=>k});')}))code=code.replaceAll(JSON.stringify(name),JSON.stringify(target));
const {ModalAdmin,DialogosAdmin}=await import(uri(code));const {h}=await import(react);
const op={titulo:'Emitir documento?',subtitulo:'Operação real',descricao:'Confira antes de confirmar',confirmar:'Autorizar',detalhes:[{rotulo:'Cliente',valor:'Cliente fictício'}]};
function walk(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=walk(child,predicate);if(found)return found;}return null;}
test('modal nativo tem título, subtítulo, descrição e Escape apenas cancela',()=>{
 h.clear();let fechou=0,executou=0,shown=0,closed=0,focused=0,restored=0;
 globalThis.HTMLElement=class {};const anterior=new HTMLElement();anterior.isConnected=true;anterior.focus=()=>restored++;
 globalThis.document={activeElement:anterior,body:{style:{overflow:'auto'}}};globalThis.domDialog={showModal(){shown++},close(){closed++}};globalThis.domButton={focus(){focused++}};
 const tree=ModalAdmin({...op,aberto:true,aoFechar:()=>fechou++,aoConfirmar:()=>executou++});
 assert.equal(tree.type,'dialog');assert.match(tree.props['aria-labelledby'],/titulo/);assert.match(tree.props['aria-describedby'],/subtitulo.*descricao/);
 const dispose=h.effects[0]();assert.equal(shown,1);assert.equal(focused,1);assert.equal(document.body.style.overflow,'hidden');
 let prevented=false;tree.props.onCancel({preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(fechou,1);assert.equal(executou,0);
 walk(tree,n=>n.type==='button'&&n.props.children==='Autorizar').props.onClick();assert.equal(executou,1);
 dispose();assert.equal(closed,1);assert.equal(document.body.style.overflow,'auto');assert.equal(restored,1);
});
test('modal ocupado desabilita ações e não permite cancelamento por Escape',()=>{
 h.clear();let fechou=0;const tree=ModalAdmin({...op,aberto:true,ocupado:true,aoFechar:()=>fechou++,aoConfirmar:()=>{}});
 tree.props.onCancel({preventDefault(){}});assert.equal(fechou,0);
 assert.equal(walk(tree,n=>n.type==='button'&&n.props.children==='Aguarde…').props.disabled,true);
});
test('confirmação só resolve true pela ação explícita; duplicidade e desmontagem cancelam',async()=>{
 h.clear();let provider=DialogosAdmin({children:null});const confirmar=provider.props.value;
 const cancelado=confirmar(op);assert.equal(await confirmar(op),false);
 h.reset();provider=DialogosAdmin({children:null});provider.props.children[1].props.aoFechar();assert.equal(await cancelado,false);
 const aprovado=confirmar(op);h.reset();provider=DialogosAdmin({children:null});provider.props.children[1].props.aoConfirmar();assert.equal(await aprovado,true);
 const pendente=confirmar(op);h.reset();DialogosAdmin({children:null});const dispose=h.effects[0]();dispose();assert.equal(await pendente,false);
});
test('painel não usa confirmação nativa do navegador nem feedback transitório simples',()=>{
 for(const file of readdirSync(new URL('../app/admin/',import.meta.url)).filter(x=>x.endsWith('.tsx'))){const src=readFileSync(new URL('../app/admin/'+file,import.meta.url),'utf8');assert.doesNotMatch(src,/window\.(confirm|alert)\(/,file);assert.doesNotMatch(src,/role="(?:status|alert)"/,file);}
 const css=readFileSync(new URL('../app/admin/dialogos-admin.module.css',import.meta.url),'utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/focus-visible/);
});
