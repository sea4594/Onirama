import {cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
const origin=(process.env.ONIRAMA_API_ORIGIN||'').trim().replace(/\/$/,'');
if(origin){const parsed=new URL(origin);if(parsed.protocol!=='https:'||parsed.origin!==origin||parsed.username||parsed.password)throw Error('ONIRAMA_API_ORIGIN must be an HTTPS origin without a path');}
const dest=resolve(process.argv[2]||'site');
rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
cpSync('public',dest,{recursive:true});cpSync('engine',join(dest,'engine'),{recursive:true});
writeFileSync(join(dest,'runtime-config.js'),`window.ONIRAMA_API_ORIGIN = ${JSON.stringify(origin)};\n`);
writeFileSync(join(dest,'.nojekyll'),'');
console.log(`Built Pages with ${origin?'backend '+origin:'offline solo only'} at ${dest}`);
