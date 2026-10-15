import {cpSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const origin=(process.env.ONIRAMA_API_ORIGIN||'').trim().replace(/\/$/,'');
if(origin){const parsed=new URL(origin);if(parsed.protocol!=='https:'||parsed.origin!==origin||parsed.username||parsed.password)throw Error('ONIRAMA_API_ORIGIN must be an HTTPS origin without a path');}
// The Firebase web configuration is public and lives in a single source file.
// Using it directly supports local Node and Pages without GitHub Actions variables.
const runtime=readFileSync('public/runtime-config.js','utf8');
if(!/^window\.ONIRAMA_API_ORIGIN = .*;$/m.test(runtime)||!runtime.includes('window.ONIRAMA_FIREBASE_CONFIG = '))throw Error('Missing runtime-config.js configuration');
const configured=runtime.replace(/^window\.ONIRAMA_API_ORIGIN = .*;$/m,`window.ONIRAMA_API_ORIGIN = ${JSON.stringify(origin)};`);
const dest=resolve(process.argv[2]||'site');
rmSync(dest,{recursive:true,force:true});mkdirSync(dest,{recursive:true});
cpSync('public',dest,{recursive:true});cpSync('engine',join(dest,'engine'),{recursive:true});
writeFileSync(join(dest,'runtime-config.js'),configured+'\nwindow.ONIRAMA_STATIC_BUILD = true;\n');
// A single ordered CSS bundle retains the source cascade exactly while
// avoiding dozens of serial stylesheet requests on mobile connections.
const sourceHTML=readFileSync('public/index.html','utf8');
const cssLink=/<link rel="stylesheet" href="\.\/([^"?#]+\.css)">/g;
const cssPaths=[...sourceHTML.matchAll(cssLink)].map(m=>m[1]);
if(cssPaths.length<12||new Set(cssPaths).size!==cssPaths.length)throw Error('Invalid stylesheet source list');
const bundle=cssPaths.map(name=>`/* ${name} */\n`+readFileSync(join('public',name),'utf8')).join('\n');
writeFileSync(join(dest,'onirama-styles.css'),bundle);
let stylesSeen=0;
const packedHTML=sourceHTML.replace(cssLink,()=>stylesSeen++===0?'<link rel="stylesheet" href="./onirama-styles.css">':'');
writeFileSync(join(dest,'index.html'),packedHTML);

let commit=process.env.GITHUB_SHA||'';
if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
// Never display a fabricated identifier when the checkout hash is unavailable.
if(!/^[a-f0-9]{40}$/.test(commit))commit=null;
writeFileSync(join(dest,'build-info.js'),`window.ONIRAMA_BUILD_COMMIT = ${JSON.stringify(commit)};\n`);
writeFileSync(join(dest,'.nojekyll'),'');
// The installed web app must have EVERY local dependency before the connection
// disappears, including lazy-loaded game engines and expansion rules modules.
// Do not cache multiplayer data, API responses or Firebase CDN modules.
function staticAssets(folder,prefix=''){
  return readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{
    const name=prefix+entry.name,path=join(folder,entry.name);
    if(entry.isDirectory())return staticAssets(path,name+'/');
    if(!entry.isFile()||name==='.nojekyll'||name==='service-worker.js')return [];
    return [name];
  });
}
const offlineAssets=staticAssets(dest).sort();
const digest=createHash('sha256');
for(const name of offlineAssets){digest.update(name);digest.update(readFileSync(join(dest,name)));}
const revision=digest.digest('hex').slice(0,16);
const worker=readFileSync('scripts/service-worker.template.js','utf8')
  .replace('/*__APP_VERSION__*/',JSON.stringify(revision))
  .replace('/*__ASSET_MANIFEST__*/',JSON.stringify(offlineAssets));
writeFileSync(join(dest,'service-worker.js'),worker);
console.log(`Built Pages with embedded Firebase config${origin?' plus optional Node backend '+origin:''} at ${dest}`);
