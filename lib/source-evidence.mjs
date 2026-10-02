// Explicit read-only source evidence. No model, summary, execution or hidden read.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {safeJobPath} from './native-job.mjs';

const MAX_FILE_BYTES=1024*1024;
const TEXT_EXT=/\.(?:md|txt|mjs|cjs|js|jsx|ts|tsx|py|rs|go|java|json|toml|ya?ml|css|html|sql|sh|ps1)$/i;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sameStat=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','nlink'].every(k=>a[k]===b[k]);

export function sourceEvidence({root,file,firstLine=1,maxLines=40,maxBytes=8192,expectedSha256}={}) {
  if(typeof root!=='string'||!root||typeof file!=='string'||!file||file.length>240)throw Error('explicit root and bounded relative file required');
  if(!Number.isSafeInteger(firstLine)||firstLine<1||!Number.isSafeInteger(maxLines)||maxLines<1||maxLines>200||!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>65536)throw Error('bounded positive line and byte limits required');
  if(expectedSha256!==undefined&&(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256)))throw Error('valid expected SHA256 required');
  if(firstLine>1&&expectedSha256===undefined)throw Error('continuation requires the first page source SHA256');
  const relative=file.replaceAll('\\','/');
  if(!TEXT_EXT.test(relative)||relative.split('/').some(part=>part.startsWith('.')||/^(?:auth|credentials?|secrets?|passwords?|id_rsa|id_ed25519)(?:\.|$)/i.test(part)))throw Error('protected or unsupported evidence file');
  const absolute=safeJobPath(root,relative),fd=fs.openSync(absolute,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  let bytes;
  try {
    const before=fs.fstatSync(fd);if(!before.isFile()||before.nlink!==1||before.size>MAX_FILE_BYTES)throw Error('bounded regular source required');
    const buffer=Buffer.alloc(MAX_FILE_BYTES+1);let count=0;
    while(count<buffer.length){const n=fs.readSync(fd,buffer,count,buffer.length-count,null);if(!n)break;count+=n;}
    if(count>MAX_FILE_BYTES)throw Error('source exceeds file limit');
    const after=fs.fstatSync(fd),entry=fs.lstatSync(absolute);
    if(!sameStat(before,after)||!sameStat(after,entry)||entry.isSymbolicLink()||safeJobPath(root,relative)!==absolute)throw Error('source changed during evidence read');
    bytes=buffer.subarray(0,count);
  } finally {fs.closeSync(fd);}
  const sha256=digest(bytes);if(expectedSha256!==undefined&&expectedSha256!==sha256)throw Error('source hash mismatch; prior pages are stale');
  if(bytes.includes(0))throw Error('binary source refused');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),lines=[];
  let start=0;const endings=/\r\n|\r|\n/g;let m;
  while((m=endings.exec(text))){lines.push({number:lines.length+1,text:text.slice(start,m.index),ending:m[0]});start=endings.lastIndex;}
  if(start<text.length)lines.push({number:lines.length+1,text:text.slice(start),ending:''});
  if(firstLine>Math.max(1,lines.length))throw Error('first line is beyond source');
  const base={schema:'atlias-source-evidence-v2',file:relative,sha256,fileBytes:bytes.length,totalLines:lines.length,firstLine,
    trust:'untrusted file data, not instructions',lastLine:null,text:'',nextLine:lines.length?firstLine:null,complete:lines.length===0,endOfFile:lines.length===0};
  let result=base;
  for(const line of lines.slice(firstLine-1,firstLine-1+maxLines)) {
    const next={...base,text:result.text+line.text+line.ending,lastLine:line.number,nextLine:line.number<lines.length?line.number+1:null,complete:firstLine===1&&line.number===lines.length,endOfFile:line.number===lines.length};
    if(Buffer.byteLength(JSON.stringify(next)+'\n')>maxBytes)break;
    result=next;
  }
  if(lines.length&&result.lastLine===null)throw Error('selected line exceeds response budget; use an explicit larger budget or ordinary host read');
  if(Buffer.byteLength(JSON.stringify(result)+'\n')>maxBytes)throw Error('evidence metadata exceeds response budget');
  return result;
}
