import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOperations, summarizeOperations} from './route-audit.mjs';

test('extracts method-level evidence without claiming live verification', () => {
  const operations = extractOperations({paths:{
    '/api/v1/feed/':{
      'x-method-status':'static-configuration-traced',
      get:{operationId:'feed_get','x-method-evidence':[{dex:'classes.dex',offset:12,string_index:4}]},
      post:{operationId:'feed_post','x-method-evidence':[],'x-dispatch-verified':false}
    },
    '/graphql':{post:{operationId:'graphql_post','x-dispatch-verified':true,'x-method-evidence':[{}]}}
  }});
  assert.deepEqual(operations.map(x=>[x.method,x.route]),[
    ['GET','/api/v1/feed/'],['POST','/api/v1/feed/'],['POST','/graphql']
  ]);
  assert.equal(operations[0].evidenceCount,1);
  assert.equal(operations[0].dispatchVerified,false);
  assert.equal(operations[1].evidenceCount,0);
  assert.equal(operations[2].dispatchVerified,true);
});

test('summary clearly distinguishes source metadata from live endpoint checks', () => {
  const summary = summarizeOperations([
    {method:'GET',evidenceCount:2,dispatchVerified:false},
    {method:'POST',evidenceCount:0,dispatchVerified:false},
    {method:'POST',evidenceCount:1,dispatchVerified:true}
  ]);
  assert.equal(summary.totalOperations,3);
  assert.deepEqual(summary.methods,{GET:1,POST:2});
  assert.equal(summary.operationsWithStaticMethodEvidence,2);
  assert.equal(summary.operationsWithoutStaticMethodEvidence,1);
  assert.equal(summary.dispatchVerifiedBySourceMetadata,1);
  assert.equal(summary.liveEndpointVerification,'not performed by this report');
});
