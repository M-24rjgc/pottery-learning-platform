// Bluetooth mixes UTF8 text with 55 55 length cmd payload checksum frames.
// Keep frames out of text lines even when a notification splits either format.
export class BleStreamDecoder{
 constructor(onText,onFrame,onInvalid=()=>{}){Object.assign(this,{onText,onFrame,onInvalid});this.reset();}
 reset(){this.buffer=Buffer.alloc(0);}
 push(bytes){
  this.buffer=Buffer.concat([this.buffer,bytes]);
  while(this.buffer.length){
   const header=this.buffer.indexOf(Buffer.from([0x55,0x55]));
   if(header<0){const keep=this.buffer.at(-1)===0x55?1:0;const n=this.buffer.length-keep;if(n)this.onText(this.buffer.subarray(0,n));this.buffer=this.buffer.subarray(n);return;}
   if(header){this.onText(this.buffer.subarray(0,header));this.buffer=this.buffer.subarray(header);}
   if(this.buffer.length<3)return;
   const length=this.buffer[2];if(length<2||length>32){this.onInvalid();this.buffer=this.buffer.subarray(2);continue;}
   if(this.buffer.length<length+3)return;
   const frame=this.buffer.subarray(0,length+3);let xor=0;for(const byte of frame.subarray(2))xor^=byte;
   this.buffer=this.buffer.subarray(length+3);
   if(xor!==0){this.onInvalid();continue;}
   this.onFrame({command:frame[3],payload:frame.subarray(4,-1)});
  }
 }
}
