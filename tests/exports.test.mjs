import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../engine.mjs';
import {calendarICS,tasksCSV,notesMarkdown} from '../exports.mjs';
test('calendar export uses an explicit timezone and escapes injected content',()=>{
 const s=seed();s.records['calendar:interview'].notes='A, B; C\nEND:VEVENT';const out=calendarICS(s.records);assert.match(out,/DTSTART;TZID=Asia\/Kolkata:20261125T100000/);assert.match(out,/DESCRIPTION:A\\, B\\; C\\nEND:VEVENT/);assert.equal(out.split('\r\nEND:VEVENT').length,2);
});
test('long Unicode calendar lines are folded below 75 bytes',()=>{
 const s=seed();s.records['calendar:interview'].notes='नमस्ते'.repeat(60);for(const line of calendarICS(s.records).split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('CSV export quotes fields and neutralizes spreadsheet formula prefixes',()=>{
 const s=seed();s.records['tasks:prepare'].title='=HYPERLINK("https://foreign.example")';const out=tasksCSV(s.records);assert.ok(out.includes('"\'=HYPERLINK(""https://foreign.example"")"'));
});
test('Markdown export escapes HTML rather than embedding executable markup',()=>{
 const s=seed();s.records['notes:travel'].route='<script>alert(1)</script>';const out=notesMarkdown(s.records);assert.ok(!out.includes('<script>'));assert.match(out,/&lt;script&gt;/);
});
