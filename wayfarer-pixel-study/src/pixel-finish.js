// Presentation only: material colors and silhouettes survive unchanged.
export class PixelFinish {
 constructor(canvas,source){this.canvas=canvas;this.source=source;this.ctx=canvas.getContext('2d',{alpha:false});}
 resize(w,h){this.canvas.width=w;this.canvas.height=h;}
 render(){this.ctx.imageSmoothingEnabled=false;this.ctx.drawImage(this.source,0,0,this.canvas.width,this.canvas.height);}
}
