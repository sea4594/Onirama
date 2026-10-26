// Small dependency-free WebSocket client for the local Chromium DevTools endpoint.
// Used only when Node does not expose the global WebSocket API.
import {EventEmitter} from 'node:events';
import {connect} from 'node:net';
import {createHash,randomBytes} from 'node:crypto';

const WS_GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export class CdpWebSocket extends EventEmitter {
 constructor(address){
  super();
  const endpoint=new URL(address);
  if(endpoint.protocol!=='ws:' || !['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw Error('Only local Chromium ws:// endpoints are supported');
  this.socket=connect(Number(endpoint.port),endpoint.hostname);
  this.connected=false;this.finished=false;this.buffer=Buffer.alloc(0);this.fragment=[];
  const key=randomBytes(16).toString('base64');
  const accept=createHash('sha1').update(key+WS_GUID).digest('base64');
  this.socket.on('connect',()=>this.socket.write([
   `GET ${endpoint.pathname}${endpoint.search} HTTP/1.1`,
   `Host: ${endpoint.host}`,'Upgrade: websocket','Connection: Upgrade',
   'Sec-WebSocket-Version: 13',`Sec-WebSocket-Key: ${key}`,'',''
  ].join('\r\n')));
  this.socket.on('data',data=>{
   this.buffer=Buffer.concat([this.buffer,data]);
   if(!this.connected){
    const end=this.buffer.indexOf('\r\n\r\n');if(end<0)return;
    const headers=this.buffer.subarray(0,end).toString('utf8');
    if(!/^HTTP\/1\.1 101\b/.test(headers)||!headers.toLowerCase().includes(`sec-websocket-accept: ${accept.toLowerCase()}`)){
     this.socket.destroy(Error('Invalid Chromium WebSocket handshake'));return;
    }
    this.buffer=this.buffer.subarray(end+4);this.connected=true;this.emit('open');
   }
   this.readFrames();
  });
  this.socket.on('error',error=>this.emit('error',error));
  this.socket.on('close',()=>{this.finished=true;this.emit('close')});
 }
 addEventListener(name,callback,options){
  if(options?.once)this.once(name,callback);else this.on(name,callback);
 }
 readFrames(){
  while(this.buffer.length>=2){
   const first=this.buffer[0],second=this.buffer[1],opcode=first&15;
   let size=second&127,offset=2;
   if(size===126){if(this.buffer.length<4)return;size=this.buffer.readUInt16BE(2);offset=4}
   else if(size===127){if(this.buffer.length<10)return;const value=this.buffer.readBigUInt64BE(2);if(value>BigInt(Number.MAX_SAFE_INTEGER)){this.socket.destroy(Error('Oversized Chromium frame'));return}size=Number(value);offset=10}
   const masked=(second&128)!==0;
   if(this.buffer.length<offset+(masked?4:0)+size)return;
   let mask;if(masked){mask=this.buffer.subarray(offset,offset+4);offset+=4}
   const payload=Buffer.from(this.buffer.subarray(offset,offset+size));
   this.buffer=this.buffer.subarray(offset+size);
   if(mask)for(let i=0;i<payload.length;i++)payload[i]^=mask[i%4];
   if(opcode===8){this.close();return}
   if(opcode===9){this.sendFrame(10,payload);continue}
   if(opcode===10)continue;
   if(opcode===1||opcode===0){this.fragment.push(payload);if((first&128)!==0){
    this.emit('message',{data:Buffer.concat(this.fragment).toString('utf8')});this.fragment=[];
   }}
  }
 }
 sendFrame(opcode,payload){
  if(!this.connected||this.finished)throw Error('Chromium WebSocket is closed');
  const data=Buffer.isBuffer(payload)?payload:Buffer.from(String(payload));
  const prefix=data.length<126?2:data.length<65536?4:10;
  const frame=Buffer.allocUnsafe(prefix+4+data.length);
  frame[0]=128|opcode;
  if(prefix===2)frame[1]=128|data.length;
  else if(prefix===4){frame[1]=128|126;frame.writeUInt16BE(data.length,2)}
  else {frame[1]=128|127;frame.writeBigUInt64BE(BigInt(data.length),2)}
  const mask=randomBytes(4);mask.copy(frame,prefix);
  for(let i=0;i<data.length;i++)frame[prefix+4+i]=data[i]^mask[i%4];
  this.socket.write(frame);
 }
 send(data){this.sendFrame(1,data)}
 close(){if(!this.finished){this.finished=true;this.socket.destroy()}}
}
