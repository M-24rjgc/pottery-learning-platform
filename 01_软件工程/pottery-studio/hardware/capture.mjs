import fs from 'node:fs';
import path from 'node:path';
export class SessionCapture{
 constructor(directory){this.directory=directory;}
 append(id,event){
  if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw Error('无效会话标识');
  fs.mkdirSync(this.directory,{recursive:true});
  const name=id+'.jsonl';fs.appendFileSync(path.join(this.directory,name),JSON.stringify(event)+'\n','utf8');return name;
 }
}
