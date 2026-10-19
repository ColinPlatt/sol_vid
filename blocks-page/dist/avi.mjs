// Decoder for the collection's AVI: one uncompressed 8-bit BI_RGB stream (palette plus bottom-up index frames).
export function decodeAvi(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=o=>String.fromCharCode(bytes[o],bytes[o+1],bytes[o+2],bytes[o+3]);
  if(bytes.length<12||tag(0)!=='RIFF'||tag(8)!=='AVI ')throw Error('Not an AVI');
  const movie={width:0,height:0,fps:15,palette:null,frames:[]};
  const walk=(start,end)=>{
    for(let o=start;o+8<=end;){
      const id=tag(o),size=view.getUint32(o+4,true),body=o+8;
      if(body+size>end)throw Error('Truncated AVI');
      if(id==='LIST')walk(body+4,body+size);
      else if(id==='avih')movie.fps=Math.round(1e6/view.getUint32(body,true));
      else if(id==='strf'){
        const header=view.getUint32(body,true),count=view.getUint32(body+32,true)||256;
        movie.width=view.getInt32(body+4,true);movie.height=view.getInt32(body+8,true);
        if(view.getUint16(body+14,true)!==8||view.getUint32(body+16,true)!==0)throw Error('Unsupported AVI');
        movie.palette=new Uint8Array(256*3);
        for(let i=0;i<count;i++){const p=body+header+i*4;movie.palette.set([bytes[p+2],bytes[p+1],bytes[p]],i*3);}
      }else if(id==='00db')movie.frames.push(bytes.subarray(body,body+size));
      o=body+size+(size&1);
    }
  };
  walk(12,bytes.length);
  const {width,height,palette,frames}=movie;
  if(!palette||width<=0||height<=0||!frames.length||frames.some(f=>f.length!==width*height))throw Error('Unsupported AVI');
  return movie;
}
/** Writes frame `index` into an RGBA ImageData of the movie's size (rows stored bottom-up). */
export function drawFrame(movie,index,image){
  const {width,height,palette}=movie,frame=movie.frames[index%movie.frames.length],out=image.data;
  for(let y=0;y<height;y++){
    const src=(height-1-y)*width;let dst=y*width*4;
    for(let x=0;x<width;x++,dst+=4){const c=frame[src+x]*3;out[dst]=palette[c];out[dst+1]=palette[c+1];out[dst+2]=palette[c+2];out[dst+3]=255;}
  }
  return image;
}
