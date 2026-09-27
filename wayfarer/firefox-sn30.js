// Firefox/macOS can normalize a uint16 HID range as signed -1..0.
// Chromium handles that HID quirk before normalizing; see controller-support.md.
// Keep this workaround restricted to the observed browser, device and data.
export function firefoxSN30Candidate(userAgent,pad){
 return /\bFirefox\/\d/.test(userAgent)&&/Macintosh|Mac OS X/.test(userAgent)&&
  !/FxiOS|iPhone|iPad|Android/.test(userAgent)&&pad.mapping===''&&
  /^2dc8-2101-8BitDo SN30 Pro for Android$/i.test(pad.id)&&pad.axes.length===7;
}
const encoded=v=>Number.isInteger(v)&&Math.abs(v)<=65535&&Math.abs(v%2)===1;
export function hasFirefoxSN30Signature(axes){
 const sticks=Array.from(axes).slice(1,5);
 return sticks.length===4&&sticks.every(v=>v===0||encoded(v))&&sticks.filter(v=>Math.abs(v)>1).length>=2;
}
export function decodeFirefoxSN30Axis(value){
 // Zero is Firefox's not-yet-reported state, not a physical stick endpoint.
 if(!encoded(value))return 0;
 // Invert Firefox's v=2*d+1, recover the unsigned 16-bit report, normalize.
 const signed=(value-1)/2,unsigned=signed<0?signed+65536:signed;
 return unsigned*2/65535-1;
}
export function firefoxSN30Axes(axes){return Array.from(axes).slice(1,5).map(decodeFirefoxSN30Axis);}
