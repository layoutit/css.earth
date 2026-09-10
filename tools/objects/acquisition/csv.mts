export function csvRow(row:string) {
  const fields=[];let field='',quoted=false;
  for(let index=0;index<row.length;index++){
    const character=row[index];
    if(character==='"'){if(quoted&&row[index+1]==='"'){field+='"';index++;}else quoted=!quoted;}
    else if(character===','&&!quoted){fields.push(field);field='';}else field+=character;
  }
  fields.push(field);return fields;
}
