// Optional fixed MCP facade. Original operations remain callable unchanged.
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export function discoveryCatalog(catalog) {
  return [{name:'harness',description:'Atlias operations on demand. list returns names/descriptions; describe returns one exact input schema; call runs that operation with arguments. Normal host tools remain available.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['list','describe','call']},tool:{type:'string',enum:catalog.map(t=>t.name)},arguments:{type:'object'}},required:['action'],additionalProperties:false}}];
}
function validate(value,schema,where) {
  if(schema.type==='object') {
    if(!object(value))throw Error(`${where}: object required`);
    for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw Error(`${where}.${key}: required`);
    for(const [key,child] of Object.entries(schema.properties||{}))if(Object.hasOwn(value,key))validate(value[key],child,`${where}.${key}`);
  } else if(schema.type==='array') {
    if(!Array.isArray(value))throw Error(`${where}: array required`);
    if(schema.items)for(const item of value)validate(item,schema.items,where+'[]');
  } else if(schema.type==='integer'? !Number.isSafeInteger(value):schema.type==='number'? typeof value!=='number'||!Number.isFinite(value):typeof value!==schema.type)throw Error(`${where}: ${schema.type} required`);
  if(schema.enum&&!schema.enum.includes(value))throw Error(`${where}: unsupported value`);
}
export function discoveryCall(catalog,dispatch,input) {
  if(!object(input)||Object.keys(input).some(k=>!['action','tool','arguments'].includes(k))||!['list','describe','call'].includes(input.action))throw Error('explicit discovery action and ordinary arguments required');
  if(input.action==='list') {
    if(Object.hasOwn(input,'tool')||Object.hasOwn(input,'arguments'))throw Error('list accepts no tool or arguments');
    return JSON.stringify(catalog.map(({name,description})=>({name,description})));
  }
  const tool=catalog.find(t=>t.name===input.tool);if(!tool)throw Error('unknown Atlias operation');
  if(input.action==='describe') {
    if(Object.hasOwn(input,'arguments'))throw Error('describe accepts no execution arguments');
    return JSON.stringify(tool);
  }
  const args=Object.hasOwn(input,'arguments')?input.arguments:{};
  validate(args,tool.inputSchema,tool.name);
  return dispatch(tool.name,args);
}
