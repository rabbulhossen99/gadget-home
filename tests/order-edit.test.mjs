import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, record } from '../server/db.mjs';
import { seed } from '../server/seed.mjs';
import { quote, placeOrder, editConfirmedOrder } from '../server/commerce.mjs';
import { orderEditSchema } from '../server/schemas.mjs';
for (const status of ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'future-status']) test(`editing persists for ${status}`, () => {
 const db=openDatabase(':memory:'); seed(db);
 const input={items:[{type:'product',productId:'vitaboost',variantId:'double',quantity:2}],area:'inside',coupon:'',name:'Test Customer',phone:'01712345678',address:'House 12 Road 3 Dhaka',note:'',paymentMethod:'cod',paymentReference:'',idempotencyKey:crypto.randomUUID()};
 input.expectedTotal=quote(db,input).total;
 let order=placeOrder(db,{id:'test-session',user_id:null},input);
 db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,order.id);
 const items=order.items.map(item=>({id:item.id,quantity:1}));
 const stock=record(db,'products','vitaboost').variants.find(v=>v.id==='double').stock;
 order=editConfirmedOrder(db,order.id,orderEditSchema.parse({items,discount:3000,shipping:6000,expectedVersion:order.version}),'admin');
 assert.equal(order.status,status); assert.equal(order.items[0].quantity,1); assert.equal(order.discount,3000); assert.equal(order.total,order.subtotal+6000-3000);
 assert.equal(db.prepare('SELECT quantity FROM order_items WHERE order_id=?').get(order.id).quantity,1);
 order=editConfirmedOrder(db,order.id,orderEditSchema.parse({items,discount:10000,shipping:6000,expectedVersion:order.version}),'admin');
 const stored=JSON.parse(db.prepare('SELECT data FROM orders WHERE id=?').get(order.id).data);
 assert.equal(stored.discount,10000); assert.equal(stored.total,stored.subtotal+6000-10000); assert.equal(order.events.length,3);
 if(status==='cancelled') assert.equal(record(db,'products','vitaboost').variants.find(v=>v.id==='double').stock,stock);
 assert.throws(()=>orderEditSchema.parse({items,discount:1050,expectedVersion:order.version}));
 assert.throws(()=>orderEditSchema.parse({items,discount:10.5,expectedVersion:order.version}));
 db.close();
});

