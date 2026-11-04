import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeSessions,chargingDuration} from '../../frontend/session-summary.js';
const now=Date.parse('2026-11-04T12:00:00Z');
const sessions=[
 {ended:Date.parse('2026-11-03T09:00:00Z'),energy:2,power:4,cost:36,settled:true,receipt:{amountCollected:0}},
 {ended:Date.parse('2026-10-31T19:00:00Z'),energy:3,power:3,cost:48},
 {ended:Date.parse('2026-10-15T09:00:00Z'),energy:1,power:2,cost:12},
 {ended:null,energy:100,power:50,cost:2000},
 {ended:Date.parse('2026-11-05T09:00:00Z'),energy:20,power:4,cost:300},
];
test('month uses Indian completion date and excludes active/future sessions',()=>assert.deepEqual(summarizeSessions(sessions,{now}),{cost:84,energy:5,minutes:90,completed:2,collected:0}));
test('week starts Monday in India',()=>assert.deepEqual(summarizeSessions(sessions,{now,period:'week'}),{cost:36,energy:2,minutes:30,completed:1,collected:0}));
test('all time retains historical charges and separates estimates from payments',()=>assert.deepEqual(summarizeSessions(sessions,{now,period:'all'}),{cost:96,energy:6,minutes:120,completed:3,collected:0}));
test('empty state and invalid numeric values cannot create NaN totals',()=>{assert.equal(summarizeSessions([],{now}).completed,0);const value=summarizeSessions([{ended:now-1,energy:NaN,power:0,cost:-10}],{now});assert.equal(value.cost,0);assert.equal(value.energy,0);assert.equal(value.minutes,0);});
test('duration formats hours and sub-minute sessions',()=>{assert.equal(chargingDuration(90),'1 h 30 min');assert.equal(chargingDuration(.4),'<1 min');assert.equal(chargingDuration(0),'0 min');assert.equal(chargingDuration(59.9),'1 h 0 min');});
