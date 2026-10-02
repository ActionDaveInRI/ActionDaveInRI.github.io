// Pointer events carry modifier state even when a key was pressed before the
// game received keyboard focus. Ctrl-click may arrive as button 2 on macOS.
export class PointerModifiers {
 constructor(){this.clear()}
 clear(){this.control=false}
 observe(event){if(event.pointerType!=='touch'&&typeof event.ctrlKey==='boolean')this.control=event.ctrlKey}
 release(code){if(code==='ControlLeft'||code==='ControlRight')this.control=false}
 primary(event,keyboardControl=false){return event.pointerType==='touch'||event.button===0||event.button===2&&(event.ctrlKey||this.control||keyboardControl)}
}
