import { useEffect, useRef, type RefObject } from "react";

/**
 * Full-screen WebGL backdrop: emerald light beams radiating from behind the globe, smoke drifting out of the beams,
 * side fog banks and slow rising motes. One fragment shader on one triangle; no library.
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
  // Beams: sharp noise around the circle (sampled on the unit circle, so there is no seam), slowly turning.
  vec2 dir=p/max(d,1e-4);
  float b=0.;
  b+=pow(n2(dir*4.0+vec2(t*.03,0.)),9.)*1.2;
  b+=pow(n2(dir*8.5+vec2(5.2,t*.04)),14.)*1.1;
  b+=pow(n2(dir*15.+vec2(-t*.025,9.1)),22.)*1.0;
  b*=.5+.5*n2(dir*2.+vec2(t*.06,2.));     // slow breathing
  float up=.55+.45*smoothstep(-.7,.9,dir.y);
  float fall=exp(-d*1.25)*smoothstep(.02,.2,d);
  float beams=b*fall*up;
  // Glow behind the globe.
  float core=exp(-d*d*22.)*.9+exp(-d*4.5)*.18;
  // Smoke carried outward along the beams (polar flow), lit by them.
  vec2 pf=dir*1.6+dir*(d*2.2-t*.10);
  float smoke=fbm(pf*1.3+fbm(p*2.2+t*.04)*.9);
  smoke=smoothstep(.4,.95,smoke)*(b*2.2+.18)*exp(-d*.95)*smoothstep(.08,.4,d);
  // Fog banks rolling in from both sides, low.
  vec2 q=vec2(p.x*1.3,p.y*1.8);
  float side=smoothstep(.3,1.2,abs(p.x))*smoothstep(.45,-.55,p.y);
  float fog=fbm(q*1.5+vec2(-sign(p.x)*t*.05,t*.02)+fbm(q*3.-t*.03)*.6);
  fog=smoothstep(.28,.95,fog)*side;
  // Floor haze.
  float floorH=smoothstep(.55,1.,1.-uv.y)*.10*(.5+.5*fbm(vec2(p.x*2.+t*.02,t*.05)));
  // Rising motes.
  vec2 g=frag/(uScale*vec2(46.));g.y-=t*.7;vec2 cell=floor(g);vec2 f=fract(g)-.5;
  float r=h2(cell);vec2 off=vec2(h2(cell+1.7),h2(cell+3.1))-.5;
  float mote=step(.972,r)*smoothstep(.08,.0,length(f-off*.7))*(.5+.5*sin(t*2.+r*40.));
  mote*=smoothstep(1.3,.15,d);
  vec3 emerald=vec3(.05,.9,.48), deep=vec3(.015,.30,.17), mint=vec3(.6,1.,.8);
  float intro=uIntro;
  vec3 col=emerald*beams*1.05*intro;
  col+=(emerald*.8+mint*.2)*core*intro;
  col+=mix(deep,emerald,.45)*smoke*1.15*intro;
  col+=mix(deep,emerald,.22+beams*.6)*fog*1.6*(.4+.6*intro);
  col+=deep*floorH*intro;
  col+=mint*mote*.5*intro;
  col=col/(1.+col*.9);                     // soft tone map, keeps blacks black
  col*=smoothstep(1.6,.25,length((uv-.5)*vec2(1.2,1.)));   // vignette
  col+=(h2(frag+fract(t))-.5)/255.*2.;   // dither against banding
  gl_FragColor=vec4(col,1.);
}`;

export default function BeamField({ anchor }: { anchor: RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const gl = el.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance", premultipliedAlpha: false });
    if (!gl) { el.dataset.fallback = "1"; return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { el.dataset.fallback = "1"; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = u("uRes"), uCenter = u("uCenter"), uTime = u("uTime"), uIntro = u("uIntro"), uScale = u("uScale");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    let scale = 1, cx = 0, cy = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      scale = dpr * (small ? 0.5 : 0.6);
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
    const loop = (now: number) => { draw(now); if (visible && !reduce) raf = requestAnimationFrame(loop); };
    const onVis = () => { visible = !document.hidden; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(loop); };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);
    if (reduce) { const id = setInterval(() => { resize(); draw(performance.now()); }, 500); setTimeout(() => clearInterval(id), 2000); }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", onVis); };
  }, [anchor]);
  return <canvas ref={canvas} className="uex-field" aria-hidden="true" />;
}
