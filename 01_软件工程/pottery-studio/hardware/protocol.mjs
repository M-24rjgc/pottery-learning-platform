import {StringDecoder} from 'node:string_decoder';
export function parseGloveLine(line){
 const text=line.trim();let m=/^D,(\d+),(\d+),(\d+),(\d+),(\d+)$/.exec(text);
 if(m){const values=m.slice(1).map(Number);return values.every(v=>v>=500&&v<=2500)?{type:'sample',values}:null;}
 m=/^模式:\s*([01])=/.exec(text);if(m)return {type:'status',mode:Number(m[1])};
 m=/^MODE:([01])$/.exec(text);if(m)return {type:'mode',mode:Number(m[1])};
 m=/^OK:G=([0-4])$/.exec(text);if(m)return {type:'gesture',kind:'correct',id:Number(m[1]),mask:null};
 m=/^ERR:mask=([01]{1,5})$/.exec(text);if(m)return {type:'gesture',kind:'incorrect',id:null,mask:Number.parseInt(m[1],2)};
 if(text.includes('陶瓷学习器 v2.1'))return {type:'boot',version:'2.1'};
 return text?{type:'text',text}:null;
}
export class LineDecoder{
 constructor(onLine,onOverflow=()=>{}){this.onLine=onLine;this.onOverflow=onOverflow;this.reset();}
 reset(){this.decoder=new StringDecoder('utf8');this.buffer='';this.discarding=false;}
 push(bytes){for(const char of this.decoder.write(bytes)){
  if(char==='\n'){if(!this.discarding)this.onLine(this.buffer.replace(/\r$/,''));this.buffer='';this.discarding=false;}
  else if(!this.discarding){this.buffer+=char;if(this.buffer.length>4096){this.buffer='';this.discarding=true;this.onOverflow();}}
 }}
}
export function commandSpec(input,{transport='serial'}={}){
 const text=String(input??'').trim().replace(/ +/g,' ').toUpperCase();
 if(/[\r\n]/.test(text))throw Error('一次只能发送一条命令');
 if(transport==='ble'&&text==='STATUS')return {text,ack:/^模式:\s*[01]=/,mutates:false,scope:'mode-only'};
 const simple={HELP:/^HELP\s+显示此帮助/,STATUS:/共\s*\d+\s*个手势|未配置任何手势/,LIST:/共\s*\d+\s*个手势|未配置任何手势/,CALIB_MIN:/最小值已记录/,CALIB_MAX:/校准完成!/,CALIB_RESET:/校准已重置/,SAVE:/配置已保存到 EEPROM/,LOAD:/配置已从 EEPROM 加载/,RESET:/所有手势已重置为未配置/};
 if(simple[text])return {text,ack:simple[text],mutates:!['HELP','STATUS','LIST'].includes(text)};
 let m=/^MODE ([01])$/.exec(text);if(m)return {text,ack:new RegExp('^MODE:'+m[1]+'$'),mutates:true};
 m=/^DELETE ([0-9])$/.exec(text);if(m)return {text,ack:new RegExp('手势 '+m[1]+' 已删除'),mutates:true};
 m=/^RECORD ([0-9])(?: (\d+))?$/.exec(text);if(m){const tolerance=Number(m[2]??100);if(tolerance<1||tolerance>1000)throw Error('硬件录制容差须为1至1000');return {text:`RECORD ${m[1]} ${tolerance}`,ack:new RegExp(`手势 ${m[1]} 已录制`),mutates:true};}
 throw Error('不支持该命令；请使用模式、校准、RECORD、DELETE、SAVE、LOAD、LIST、STATUS或HELP');
}
