export function quotaRejected(text){
 const events=text.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const errors=events.filter(e=>e.type==='error'&&typeof e.message==='string'&&e.message.startsWith('You’ve hit your usage limit.'));
 return errors.some(e=>events.some(f=>f.type==='turn.failed'&&f.error?.message===e.message));
}
