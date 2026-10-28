import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import handler from '../api/starter-workbook.js';
const original=process.env.BBC_WORKBOOK_PASSWORD;
function response(){return {headers:{},setHeader(name,value){this.headers[name]=value;},end(body){this.body=body;}};}
try{
 delete process.env.BBC_WORKBOOK_PASSWORD;
 let res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,503);
 process.env.BBC_WORKBOOK_PASSWORD='test-only-password';
 res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
 res=response();await handler({method:'GET',headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401);
 res=response();await handler({method:'GET',headers:{authorization:'Bearer test-only-password'}},res);assert.equal(res.statusCode,200);assert.deepEqual(res.body,await readFile(new URL('../private/starter.xlsx',import.meta.url)));assert.equal(res.headers['Cache-Control'],'private, no-store');
 res=response();await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,405);
 console.log('5 starter API checks passed: missing configuration, missing/wrong password, exact workbook bytes, method restriction.');
}finally{if(original===undefined)delete process.env.BBC_WORKBOOK_PASSWORD;else process.env.BBC_WORKBOOK_PASSWORD=original;}
