import {cpSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
const origin=(process.env.ONIRAMA_API_ORIGIN||'').trim().replace(/\/$/,'');
if(origin){const parsed=new URL(origin);if(parsed.protocol!=='https:'||parsed.origin!==origin||parsed.username||parsed.password)throw Error('ONIRAMA_API_ORIGIN must be an HTTPS origin without a path');}
const firebaseConfig={apiKey:process.env.ONIRAMA_FIREBASE_API_KEY||'',authDomain:process.env.ONIRAMA_FIREBASE_AUTH_DOMAIN||'',projectId:process.env.ONIRAMA_FIREBASE_PROJECT_ID||'',appId:process.env.ONIRAMA_FIREBASE_APP_ID||'',messagingSenderId:process.env.ONIRAMA_FIREBASE_MESSAGING_SENDER_ID||'',storageBucket:process.env.ONIRAMA_FIREBASE_STORAGE_BUCKET||''};
const firebasePresent=Object.values(firebaseConfig).some(Boolean);
if(firebasePresent&&!['apiKey','authDomain','projectId','appId'].every(k=>firebaseConfig[k]))throw Error('Incomplete Firebase configuration: apiKey, authDomain, projectId and appId are required');
const dest=resolve(process.argv[2]||'site');
rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
cpSync('public',dest,{recursive:true});cpSync('engine',join(dest,'engine'),{recursive:true});
writeFileSync(join(dest,'runtime-config.js'),`window.ONIRAMA_API_ORIGIN = ${JSON.stringify(origin)};\nwindow.ONIRAMA_FIREBASE_CONFIG = ${JSON.stringify(firebasePresent?firebaseConfig:null)};\n`);
writeFileSync(join(dest,'.nojekyll'),'');
console.log(`Built Pages with ${firebasePresent?'Firebase multiplayer':origin?'Node backend '+origin:'offline solo only'} at ${dest}`);
