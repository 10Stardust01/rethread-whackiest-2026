import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCalendar,patchCalendar,CalDavRecovery} from '../caldav.mjs';
import {calendarICS} from '../exports.mjs';
import {seed} from '../engine.mjs';
const fixture=()=>calendarICS(seed().records);
test('CalDAV adapter preserves unrelated event properties when changing time',()=>{
 const input=fixture(),output=patchCalendar(input,{start:'2026-11-25T14:00'});assert.equal(inspectCalendar(output).fields.start,'2026-11-25T14:00');assert.equal(inspectCalendar(output).fields.notes,'Bring portfolio');
});
test('timezone transition DTSTART is not confused with the event DTSTART',()=>{
 const input=fixture().replace('BEGIN:VEVENT','BEGIN:VTIMEZONE\r\nTZID:Asia/Kolkata\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT');
 const output=patchCalendar(input,{start:'2026-11-25T14:00'});assert.ok(output.includes('DTSTART:19700101T000000'));assert.equal(inspectCalendar(output).fields.start,'2026-11-25T14:00');
});
test('events with attendees, recurrence or alarms are refused',()=>{
 for(const extra of ['ATTENDEE:mailto:person@example.invalid','RRULE:FREQ=DAILY','BEGIN:VALARM\r\nACTION:DISPLAY\r\nEND:VALARM','DTEND;TZID=Asia/Kolkata:20261125T110000'])assert.throws(()=>inspectCalendar(fixture().replace('END:VEVENT',extra+'\r\nEND:VEVENT')));
});
test('live adapter refuses non-loopback destinations and unsafe capture identities',async()=>{
 assert.throws(()=>patchCalendar(fixture(),JSON.parse('{"constructor":"x"}')),/Unsupported/);
 assert.throws(()=>new CalDavRecovery({url:'https://outside.example/event.ics',directory:'unused'}));
 const c=new CalDavRecovery({url:'http://127.0.0.1:5237/a.ics',directory:'unused'});await assert.rejects(()=>c.load('../state.json'),/identity/);
});
