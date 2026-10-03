import AdmZip from "../admin-api/node_modules/adm-zip/adm-zip.js";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
const stage=resolve(process.argv[2]);
const zip=new AdmZip();
async function add(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,item.name);
    if(item.isDirectory())await add(path);
    else if(item.isFile())zip.addFile(relative(stage,path).replaceAll("\\","/"),await readFile(path));
  }
}
await add(stage);
zip.writeZip(`${stage}.zip`);
console.log("Pacote Linux preparado com caminhos POSIX.");
