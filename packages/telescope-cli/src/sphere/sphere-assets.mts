/** Clear only inactive CSS image bindings; retain every other prepared property. */
export function clearInactiveImageBindings<T extends {readonly name:string;readonly value:string}>(properties:readonly T[],excluded:readonly {readonly url:string}[]){
  const urls=new Set(excluded.map(entry=>entry.url)),inactiveImageProperties:string[]=[];
  const result=properties.map(property=>{
    const value=property.value.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(match,_quote,url:string)=>urls.has(url.trim())?'none':match);
    if(value===property.value)return property;
    inactiveImageProperties.push(property.name);return {...property,value};
  });
  return {properties:result,inactiveImageProperties};
}
