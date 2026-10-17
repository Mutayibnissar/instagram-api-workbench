import test from 'node:test';
import assert from 'node:assert/strict';
import {extractOperations, filterOperations, markdown, summarizeOperations} from './route-audit.mjs';

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

test('flags write operations, missing documentation, and undeclared path parameters', () => {
  const operations = extractOperations({paths:{
    '/users/{userId}':{
      get:{operationId:'get_user',summary:'Get a user',parameters:[{name:'userId',in:'path',required:true,schema:{type:'string'}}]},
      delete:{parameters:[]}
    },
    '/posts/{postId}':{
      post:{operationId:'create_post',summary:'Create post'}
    }
  }});
  const getUser = operations.find(x => x.method === 'GET');
  const deleteUser = operations.find(x => x.method === 'DELETE');
  const createPost = operations.find(x => x.method === 'POST');
  assert.deepEqual(getUser.undeclaredPathParams, []);
  assert.equal(deleteUser.isWriteOperation, true);
  assert.deepEqual(deleteUser.undeclaredPathParams, ['userId']);
  assert.deepEqual(createPost.undeclaredPathParams, ['postId']);
  const summary = summarizeOperations(operations);
  assert.equal(summary.writeOperationsRequireCarefulReview, 2);
  assert.equal(summary.operationsMissingOperationId, 1);
  assert.equal(summary.operationsMissingSummary, 1);
  assert.equal(summary.operationsWithUndeclaredPathParameters, 2);
});

test('filters route inventories into write-only and review queues', () => {
  const operations = extractOperations({paths:{
    '/health':{get:{operationId:'health_get',summary:'Health check'}},
    '/users/{id}':{get:{operationId:'user_get',summary:'Get user',parameters:[{name:'id',in:'path'}]},delete:{operationId:'user_delete',summary:'Delete user',parameters:[{name:'id',in:'path'}]}},
    '/unknown/{slug}':{post:{summary:'Create unknown'}}
  }});
  assert.deepEqual(filterOperations(operations,{writesOnly:true}).map(x=>x.method),['DELETE','POST']);
  const review = filterOperations(operations,{needsReview:true});
  assert.equal(review.some(x=>x.route==='/health'),false);
  assert.equal(review.some(x=>x.route==='/unknown/{slug}'),true);
  assert.equal(review.some(x=>x.method==='DELETE'),true);
  assert.equal(filterOperations(operations,{writesOnly:true,needsReview:true}).every(x=>x.isWriteOperation),true);
});

test('escapes pipe characters in Markdown table cells with one escape', () => {
  const operations = extractOperations({paths:{
    '/users/{id}|archive':{get:{operationId:'get|archive',summary:'Archive candidate'}}
  }});
  const report = markdown(operations, summarizeOperations(operations));
  assert.ok(report.includes(String.raw`/users/{id}\|archive`));
  assert.ok(report.includes(String.raw`get\|archive`));
  assert.ok(!report.includes(String.raw`\\|archive`));
});
