/** Prepare a CSS expression graph. Registered numbers make intermediate results
 * compute once on the viewport instead of expanding token trees on every leaf.
 * None of them inherit: `carry-values.mts` gives each reader, and the ancestors
 * above it, an explicit `inherit`, so a camera change restyles only those elements. */
export type Value = number | string;
export type Matrix = readonly Value[];
export class CssValues {
  private readonly entries = new Map<string, {name:string;reference:string}>();
  private readonly declarations: string[] = [];
  private readonly matrices: string[] = [];
  outputMatrix(matrix:Matrix):string {
    const name=`--native-m${this.matrices.length}`;
    this.matrices.push(name);
    this.declarations.push(`${name}:${matrixCss(matrix)}`);
    return `var(${name})`;
  }
  value(expression: string): string {
    const known = this.entries.get(expression);
    if (known) return known.reference;
    const name = `--native-c${this.entries.size}`;
    // WebKit serializes small registered numbers to six decimal places before
    // var() consumes them. Scaled storage preserves the small perspective terms;
    // every expression reads the original units again before doing arithmetic.
    const reference = `calc(var(${name}) / 1e6)`;
    this.entries.set(expression, {name,reference});
    this.declarations.push(`${name}:calc((${expression}) * 1e6)`);
    return reference;
  }
  sum(...values: Value[]): Value {
    const constant = values.filter((v): v is number => typeof v === 'number').reduce((a,b)=>a+b,0);
    const parts: Value[] = values.filter(v=>typeof v !== 'number');
    if (constant !== 0) parts.push(constant);
    return parts.length === 0 ? 0 : parts.length === 1 ? parts[0] : this.value(parts.join(' + '));
  }
  mul(a: Value,b: Value): Value {
    if (a === 0 || b === 0) return 0;
    if (a === 1) return b;
    if (b === 1) return a;
    return typeof a === 'number' && typeof b === 'number' ? a*b : this.value(`${a} * ${b}`);
  }
  sub(a: Value,b: Value): Value { return this.sum(a,this.mul(-1,b)); }
  div(a: Value,b: Value): Value {
    if (a === 0) return 0;
    if (b === 1) return a;
    return typeof a === 'number' && typeof b === 'number' ? a/b : this.value(`${a} / ${b}`);
  }
  square(a: Value): Value { return this.mul(a,a); }
  sqrt(a: Value): Value { return typeof a === 'number' ? Math.sqrt(Math.max(0,a)) : this.value(`sqrt(max(0, ${a}))`); }
  max(...values: Value[]): Value { return values.every(v=>typeof v==='number') ? Math.max(...values) : this.value(`max(${values.join(',')})`); }
  dot(a: Matrix,b: Matrix): Value { return this.sum(...a.map((v,i)=>this.mul(v,b[i]))); }
  multiply(a: Matrix,b: Matrix): Matrix {
    return Array.from({length:16},(_,i)=>this.dot([a[i%4],a[i%4+4],a[i%4+8],a[i%4+12]],b.slice(Math.floor(i/4)*4,Math.floor(i/4)*4+4)));
  }
  chain(...matrices: Matrix[]): Matrix { return matrices.reduce((a,b)=>this.multiply(a,b)); }
  inverse(m: Matrix): Matrix {
    const [a,d,g,,b,e,h,,c,f,i]=m;
    const co=(a:Value,b:Value,c:Value,d:Value)=>this.sub(this.mul(a,b),this.mul(c,d));
    const ae=co(e,i,f,h),af=co(f,g,d,i),ag=co(d,h,e,g);
    const determinant=this.sum(this.mul(a,ae),this.mul(b,af),this.mul(c,ag));
    const inverse:Value[]=[ae,af,ag,0,co(c,h,b,i),co(a,i,c,g),co(b,g,a,h),0,co(b,f,c,e),co(c,d,a,f),co(a,e,b,d),0,0,0,0,determinant].map(v=>this.div(v,determinant));
    for(let row=0;row<3;row++) inverse[12+row]=this.mul(-1,this.dot([inverse[row],inverse[row+4],inverse[row+8]],m.slice(12,15)));
    return inverse;
  }
  rotation(axis:'x'|'y'|'z',angle: string): Matrix {
    const c=this.value(`cos(${angle})`),s=this.value(`sin(${angle})`),n=this.mul(-1,s);
    return axis==='x'?[1,0,0,0,0,c,s,0,0,n,c,0,0,0,0,1]
      :axis==='y'?[c,0,n,0,0,1,0,0,s,0,c,0,0,0,0,1]
        :[c,s,0,0,n,c,0,0,0,0,1,0,0,0,0,1];
  }
  css(externalReferences: string): string {
    const external = new Set([...externalReferences.matchAll(/var\((--native-c\d+)\)/gu)].map(match=>match[1]!));
    const declarations = new Map(this.declarations.map(declaration=>{
      const colon=declaration.indexOf(':');
      return [declaration.slice(0,colon),declaration.slice(colon+1)] as const;
    }));
    // The graph is built in dependency order. Inline single-use intermediates
    // backwards, without duplicating work or touching values read by the scene.
    for (const [expression,{name,reference}] of [...this.entries].reverse()) {
      if (external.has(name)) continue;
      const token=`var(${name})`;
      const readers=[...declarations].filter(([,value])=>value.includes(token));
      const uses=readers.reduce((sum,[,value])=>sum+value.split(token).length-1,0);
      if (uses>1 || (uses===1 && !readers[0]![1].includes(reference))) continue;
      declarations.delete(name);
      if (uses===1) declarations.set(readers[0]![0],readers[0]![1].replace(reference,`calc(${expression})`));
    }
    const registered=Array.from(this.entries.values()).filter(({name})=>declarations.has(name)).map(({name})=>`@property ${name}{syntax:'<number>';inherits:false;initial-value:0}`).join('\n');
    const matrices=this.matrices.map(name=>`@property ${name}{syntax:'<transform-list>';inherits:false;initial-value:matrix(1,0,0,1,0,0)}`).join('\n');
    return `${registered}\n${matrices}\n.object-viewport{${[...declarations].map(([name,value])=>`${name}:${value}`).join(';')}}`;
  }
}
export const identity: Matrix = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export const matrixCss=(matrix: Matrix)=>`matrix3d(${matrix.map(v=>typeof v==='number' && Math.abs(v)<1e-14?0:v).join(',')})`;
