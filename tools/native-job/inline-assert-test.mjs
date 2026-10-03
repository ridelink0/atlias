// Executed local assertions plus adversarial classification, no model calls.
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {looksLikeVerification} from '../../lib/core.mjs';import {verdict} from '../../lib/integrity.mjs';
const bind='const assert=require("node:assert/strict");';let checks=0;
const ok=f=>{f();checks++;};const command=s=>"node -e '"+s+"'";
for(const source of [
 bind+'const hash=b=>String(b); assert.equal(hash(0),"0");',
 bind+'const xs=[0,null,false].map(x=>({value:x})); assert.deepEqual(xs,[{value:0},{value:null},{value:false}]);',
 bind+'function value(){return false;} assert.equal(value(),false);',
 bind+'for(let i=0;i<2;i++){}; assert.equal(0,0);',
 bind+'/* printed assert(false) */ const xs=[1].map(x=>{assert.equal(x,1);return x}); assert.equal(xs[0],1);',
 bind+'// callback context\nconst f=()=>{assert.equal(1,1)}; assert.equal(typeof f,"function");'
]){ok(()=>assert(looksLikeVerification(command(source))));const p=spawnSync(process.execPath,['-e',source],{encoding:'utf8',windowsHide:true,timeout:5000});ok(()=>assert.equal(p.status,0));ok(()=>assert.equal(verdict({tool_response:{stdout:p.stdout,stderr:p.stderr,exit_code:p.status}}).outcome,'pass'));}
for(const source of [
 bind+'const f=()=>\nassert.equal(1,2);',
 bind+'const f=()=>{assert.equal(1,2)};',
 bind+'if(false)\nassert.equal(1,2);',
 bind+'for(let i=0;i<0;i++)\nassert.equal(1,2);',
 bind+'console.log("assert.equal(1,2)");',
 'const assert=()=>true; assert(false);',
 'console.log("assert=require(\\"node:assert\\")"); const assert=x=>x; assert(false);',
 bind+'assert.equal=()=>true; assert.equal(1,2);',
 bind+'assert["equal"]=()=>true; assert.equal(1,2);',
 bind+'assert=()=>true; assert(false);',
 bind+'process.exit(0); assert.equal(1,2);',
 bind+'require("process").exit(0); assert.equal(1,2);',
 bind+'process["exit"](0); assert.equal(1,2);',
 bind+'eval("process.exit(0)"); assert.equal(1,2);',
 'function unused(){const assert=require("node:assert");} const x=()=>0; assert.equal(x(),1);',
 bind+'const xs=[1].map(x=>x/2); assert.equal(xs[0],0.5);',
 bind+'const xs=[1].map(x=>`value${x}`); assert.equal(xs.length,1);',
 bind+'/* unterminated',
 'echo "node -e '+bind+'const f=()=>1; assert.equal(f(),1);"'
])ok(()=>assert.equal(looksLikeVerification(command(source)),false,source));
const failing=bind+'const f=()=>0; assert.equal(f(),1);';ok(()=>assert(looksLikeVerification(command(failing))));const p=spawnSync(process.execPath,['-e',failing],{encoding:'utf8',windowsHide:true,timeout:5000});ok(()=>assert.notEqual(p.status,0));ok(()=>assert.equal(verdict({tool_response:{stdout:p.stdout,stderr:p.stderr,exit_code:p.status}}).outcome,'fail'));
ok(()=>assert(!looksLikeVerification('if ($false) { '+command(bind+'const f=()=>1; assert.equal(f(),1);')+' }')));
ok(()=>assert(!looksLikeVerification('Write-Output '+JSON.stringify(command(bind+'const f=()=>1; assert.equal(f(),1);')))));
console.log(`${checks} inline assertion controls passed; real local pass/fail outcomes, zero models. Classifier is not semantic proof.`);
