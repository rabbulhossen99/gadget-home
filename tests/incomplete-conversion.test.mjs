import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, record } from '../server/db.mjs';
import { seed } from '../server/seed.mjs';
import { convertIncompleteOrder, editConfirmedOrder } from '../server/commerce.mjs';
import { randomUUID } from 'node:crypto';
test('incomplete conversion is persistent, atomic and duplicate safe',()=>{
 const db=openDatabase(':memory:'); seed(db);
 const checkout=randomUUID(), session=randomUUID();
 db.prepare('INSERT INTO sessions(id,csrf,expires) VALUES(?,?,?)').run(session,'test',Date.now()+10000);
 const draft={name:'Customer',phone:'01712345678',address:'House 12 Road 3 Dhaka',note:'Call first',items:[{type:'product',productId:'vitaboost',variantId:'double',quantity:2}],area:'inside'};
 db.prepare('INSERT INTO checkouts(id,session_id,data) VALUES(?,?,?)').run(checkout,session,JSON.stringify(draft));
 const stock=record(db,'products','vitaboost').variants.find(v=>v.id==='double').stock;
 const order=convertIncompleteOrder(db,checkout,'admin');
 assert.equal(order.status,'pending'); assert.equal(order.phone,draft.phone);assert.equal(order.note,draft.note);
 assert.equal(convertIncompleteOrder(db,checkout,'admin').id,order.id);
 assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,1);
 assert.equal(db.prepare('SELECT count(*) AS n FROM checkouts WHERE id=?').get(checkout).n,0);
 assert.ok(JSON.parse(db.prepare('SELECT data FROM orders').get().data).convertedAt);
 assert.equal(record(db,'products','vitaboost').variants.find(v=>v.id==='double').stock,stock-2);
 const edited=editConfirmedOrder(db,order.id,{items:order.items.map(i=>({id:i.id,quantity:1})),discount:3000,shipping:6000,expectedVersion:order.version},'admin');
 assert.equal(edited.total,edited.subtotal+3000);
 assert.throws(()=>editConfirmedOrder(db,order.id,{items:edited.items.map(i=>({id:i.id,quantity:1})),discount:3000,customerInfo:{phone:'01812345678'},expectedVersion:edited.version},'admin'));
 db.close();
});

