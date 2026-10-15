import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve('public');
const asset=path=>readFileSync(resolve(root,path));
const dimensions=path=>{const png=asset(path);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path);return [png.readUInt32BE(16),png.readUInt32BE(20)];};
test('browser icons and iOS home-screen icon exist at their advertised sizes',()=>{
 for(const [path,size] of [['icons/favicon-16.png',16],['icons/favicon-32.png',32],['icons/icon-64.png',64],['icons/icon-192.png',192],['icons/icon-512.png',512],['icons/icon-maskable-512.png',512],['apple-touch-icon.png',180]])assert.deepEqual(dimensions(path),[size,size]);
 const ico=asset('favicon.ico');assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);assert.ok(ico.readUInt16LE(4)>=3);
});
test('manifest works under the GitHub Pages subpath and provides maskable artwork',()=>{
 const manifest=JSON.parse(asset('site.webmanifest').toString('utf8'));
 assert.equal(manifest.name,'Onirama');assert.equal(manifest.display,'standalone');
 const base='https://sea4594.github.io/Onirama/';
 assert.equal(new URL(manifest.start_url,new URL('site.webmanifest',base)).href,base);
 assert.equal(new URL(manifest.scope,new URL('site.webmanifest',base)).href,base);
 for(const image of manifest.icons){assert.ok(image.purpose==='any'||image.purpose==='maskable');assert.equal(image.type,'image/png');assert.ok(existsSync(resolve(root,image.src)));const side=Number(image.sizes.split('x')[0]);assert.deepEqual(dimensions(image.src),[side,side]);}
 assert.ok(manifest.icons.some(image=>image.purpose==='maskable'&&image.sizes==='512x512'));
});
test('app document references favicons, install manifest, iOS icon, and share preview',()=>{
 const html=asset('index.html').toString('utf8');
 for(const ref of ['favicon.ico','icons/favicon-16.png','icons/favicon-32.png','apple-touch-icon.png','site.webmanifest','icons/icon-512.png'])assert.ok(html.includes(ref),ref);
 const app=asset('app.js').toString('utf8');assert.match(app,/class="brand-icon" src="\.\/icons\/icon-64\.png"/);
 const mime=readFileSync('server/index.js','utf8');assert.match(mime,/\.webmanifest'\s*:\s*'application\/manifest\+json'/);
});
