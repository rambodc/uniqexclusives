import { useEffect, useRef, type RefObject } from "react";

/**
 * Full-screen WebGL backdrop: emerald light beams turning and flickering behind the globe, two sweeping searchlights,
 * shine pulses racing out along the beams, dense swirling smoke lit where the beams cut through it, side fog and rising motes. One fragment shader on one triangle; no library.
 * Renders at a reduced resolution (the look is soft anyway) so it stays smooth on iPhone.
 * With prefers-reduced-motion it draws a single still frame.
 */
const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform vec2 uRes;uniform vec2 uCenter;uniform float uTime;uniform float uIntro;uniform float uScale;
float h1(float n){return fract(sin(n)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n1(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(h1(i),h1(i+1.),f);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*n2(p);p=m*p;a*=.5;}return v;}
void main(){
  vec2 frag=gl_FragCoord.xy;
  float s=min(uRes.x,uRes.y);
  vec2 p=(frag-uCenter)/s;              // centred on the globe, aspect-correct
  vec2 uv=frag/uRes;
  float d=length(p);
  float a=atan(p.y,p.x);
  float t=uTime;
  vec2 dir=p/max(d,1e-4);
  // Beams: sharp noise around the circle (sampled on the unit circle, so there is no seam), turning briskly in layers.
  float rot1=t*.16, rot2=-t*.11;
  vec2 d1=vec2(cos(a+rot1),sin(a+rot1)), d2=vec2(cos(a+rot2),sin(a+rot2));
  float b=0.;
  b+=pow(n2(d1*4.0+vec2(t*.20,0.)),8.)*1.5;
  b+=pow(n2(d2*8.5+vec2(5.2,t*.26)),12.)*1.4;
  b+=pow(n2(d1*15.+vec2(-t*.30,9.1)),18.)*1.2;
  b*=.55+.6*n2(d2*2.+vec2(t*.45,2.));                  // breathing
  b*=.78+.42*n2(vec2(a*3.,t*7.));                       // flicker, sector by sector
  // Two searchlights sweeping round, plus shine pulses racing outward along the beams.
  float sweep=pow(max(0.,cos(a-t*.85)),46.)*1.25+pow(max(0.,cos(a+t*.6+2.1)),70.)*.95;
  float pulse=pow(n1(d*7.-t*3.2+a*1.7),6.)*.9+pow(n1(d*11.-t*4.6-a*2.3+7.),9.)*.6;
  float up=.6+.4*smoothstep(-.7,.9,dir.y);
  float fall=exp(-d*1.05)*smoothstep(.02,.2,d);
  float beams=(b*(1.+pulse*1.3)+sweep*(.6+pulse))*fall*up;
  // Glow behind the globe, shimmering.
  float core=(exp(-d*d*20.)*.95+exp(-d*4.)*.22)*(.92+.08*sin(t*5.3)+.06*sin(t*13.1));
  // Smoke: swirling, domain-warped, filling the room and lit where the beams cut through it (volumetric look).
  float sw=.9*sin(t*.25)+1.6/(1.+d*3.);
  mat2 R=mat2(cos(sw),-sin(sw),sin(sw),cos(sw));
  vec2 sp=R*p*1.7+vec2(t*.07,-t*.11);
  vec2 warp=vec2(fbm(sp*1.1+vec2(0.,t*.18)),fbm(sp*1.1+vec2(5.2,-t*.15)));
  float smoke=fbm(sp*1.6+warp*1.9+vec2(-t*.12,t*.05));
  smoke=smoothstep(.32,.9,smoke)*smoothstep(.06,.3,d)*(.45+.55*exp(-d*.6));
  float lit=.2+beams*2.1+sweep*fall*1.4+core*.7;
  // Fog banks rolling in from both sides, low and quicker.
  vec2 q=vec2(p.x*1.3,p.y*1.8);
  float side=smoothstep(.25,1.15,abs(p.x))*smoothstep(.5,-.55,p.y);
  float fog=fbm(q*1.5+vec2(-sign(p.x)*t*.16,t*.05)+warp*.8);
  fog=smoothstep(.26,.92,fog)*side;
  // Floor haze.
  float floorH=smoothstep(.5,1.,1.-uv.y)*.16*(.5+.5*smoke+.3*fbm(vec2(p.x*2.+t*.08,t*.1)));
  // Rising motes catching the light.
  vec2 g=frag/(uScale*vec2(46.));g.y-=t*1.1;vec2 cell=floor(g);vec2 f=fract(g)-.5;
  float r=h2(cell);vec2 off=vec2(h2(cell+1.7),h2(cell+3.1))-.5;
  float mote=step(.968,r)*smoothstep(.08,.0,length(f-off*.7))*(.5+.5*sin(t*3.+r*40.));
  mote*=smoothstep(1.3,.15,d)*(.6+beams*2.);
  vec3 emerald=vec3(.05,.95,.5), deep=vec3(.015,.30,.17), mint=vec3(.65,1.,.83);
  float intro=uIntro;
  vec3 col=mix(emerald,mint,clamp(sweep*.5+pulse*.25,0.,.6))*beams*1.35*intro;
  col+=(emerald*.8+mint*.2)*core*1.1*intro;
  col+=mix(deep,mix(emerald,mint,.25),clamp(lit*.5,0.,1.))*smoke*lit*.95*intro;
  col+=mix(deep,emerald,.22+beams*.6)*fog*1.7*(.4+.6*intro);
  col+=deep*floorH*intro;
  col+=mint*mote*.6*intro;
  col=col/(1.+col*.8);                     // soft tone map, keeps blacks black
  col*=smoothstep(1.6,.25,length((uv-.5)*vec2(1.2,1.)));   // vignette
  col+=(h2(frag+fract(t))-.5)/255.*2.;   // dither against banding
  gl_FragColor=vec4(col,1.);
}`;

export default function BeamField({ anchor }: { anchor: RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance", premultipliedAlpha: false });
    if (!gl) { console.warn("UEX backdrop: no WebGL"); el.dataset.fallback = "1"; return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("UEX backdrop shader:", gl.getProgramInfoLog(prog)); el.dataset.fallback = "1"; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uCenter = u("uCenter"), uTime = u("uTime"), uIntro = u("uIntro"), uScale = u("uScale");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    let scale = 1, cx = 0, cy = 0, quality = 1;   // quality drops if the device can't keep up (see loop)
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      scale = dpr * (small ? 0.5 : 0.6) * quality;
      const w = Math.max(2, Math.round(el.clientWidth * scale)), h = Math.max(2, Math.round(el.clientHeight * scale));
      if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
      gl.viewport(0, 0, w, h);
      const box = anchor.current?.getBoundingClientRect(), host = el.getBoundingClientRect();
      const ax = box ? box.left + box.width / 2 - host.left : host.width / 2, ay = box ? box.top + box.height * 0.5 - host.top : host.height * 0.4;
      cx = ax * scale; cy = h - ay * scale;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el); if (anchor.current) ro.observe(anchor.current);
    window.addEventListener("resize", resize);
    const start = performance.now();
    let raf = 0, visible = true;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      gl.uniform2f(uRes, el.width, el.height); gl.uniform2f(uCenter, cx, cy); gl.uniform1f(uScale, scale);
      gl.uniform1f(uTime, reduce ? 12 : t + 8); gl.uniform1f(uIntro, reduce ? 1 : Math.min(1, Math.pow(t / 2.4, 1.6)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Adaptive resolution: if frames average over ~22 ms (under ~45 fps), render the buffer smaller (it is soft light anyway).
    let frames = 0, last = 0, sum = 0;
    const loop = (now: number) => {
      draw(now);
      if (last) { sum += now - last; if (++frames === 45) { if (sum / frames > 22 && quality > 0.55) { quality *= 0.78; resize(); } frames = 0; sum = 0; } }
      last = now;
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    };
    const onVis = () => { visible = !document.hidden; cancelAnimationFrame(raf); last = 0; frames = 0; sum = 0; if (visible) raf = requestAnimationFrame(loop); };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);
    if (reduce) { const id = setInterval(() => { resize(); draw(performance.now()); }, 500); setTimeout(() => clearInterval(id), 2000); }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, [anchor]);
  return <canvas ref={canvas} className="uex-field" aria-hidden="true" />;
}
