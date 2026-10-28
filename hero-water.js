/* Governance hero: the ocean ripples and the clouds drift slowly. A small WebGL
   shader moves only the water and the cloud band of the aerial island photo
   (the island, beaches and reef stay still). Falls back to the still photo when
   WebGL is missing or the visitor prefers reduced motion. */
(function () {
  var img = document.querySelector('[data-water-hero]');
  if (!img) return;
  // only for the aerial photo the mask was traced from (an editor may swap the picture)
  if (!/13b5bb981b59fb5a\.jpg/.test(img.getAttribute('src') || '')) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Island outline (with beach and reef margin) in 768x512 image space.
  var ISLAND = [[122,252],[130,236],[150,214],[165,196],[188,184],[240,179],[285,176],[345,177],[372,190],[400,203],[470,208],[560,210],[640,214],[664,222],[668,246],[690,268],[720,282],[752,292],[760,302],[740,312],[668,310],[600,304],[566,312],[548,328],[470,336],[382,336],[346,352],[334,370],[270,374],[198,366],[162,352],[156,322],[146,292],[128,272]];

  function buildMask() {
    var w = 768, h = 512;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    // red = water, green = cloud band
    var water = g.createLinearGradient(0, 146, 0, 172);
    water.addColorStop(0, 'rgb(0,0,0)'); water.addColorStop(1, 'rgb(255,0,0)');
    g.fillStyle = water; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000'; g.beginPath();
    ISLAND.forEach(function (p, i) { i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath(); g.fill();
    g.globalCompositeOperation = 'lighter';
    var sky = g.createLinearGradient(0, 0, 0, 158);
    sky.addColorStop(0, 'rgb(0,255,0)'); sky.addColorStop(0.82, 'rgb(0,255,0)'); sky.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = sky; g.fillRect(0, 0, w, 158);
    g.globalCompositeOperation = 'source-over';
    // soften the edges: shrink then enlarge with smoothing
    var t = document.createElement('canvas'); t.width = w / 8; t.height = h / 8;
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    var o = document.createElement('canvas'); o.width = w; o.height = h;
    var og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(c, 0, 0); og.globalAlpha = 0.6; og.drawImage(t, 0, 0, w, h);
    return o;
  }

  var VS = 'attribute vec2 p;varying vec2 v;uniform vec4 crop;void main(){v=vec2(crop.x+(p.x*0.5+0.5)*crop.z,crop.y+(0.5-p.y*0.5)*crop.w);gl_Position=vec4(p,0.0,1.0);}';
  var FS = [
    'precision highp float;varying vec2 v;uniform sampler2D tex,msk;uniform float t;',
    'const float W=1536.0,H=1024.0,HZ=296.0,F=900.0,CX=768.0;',
    'float sm(float a,float b,float x){float k=clamp((x-a)/(b-a),0.0,1.0);return k*k*(3.0-2.0*k);}',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(17.0,9.0);a*=0.5;}return s;}',
    // cloud density: flattened toward the horizon (oblique aerial view), drifting right
    'float cloud(vec2 px,float t){float pp=clamp((px.y-120.0)/(H-120.0),0.0,1.0);float sy=mix(0.45,1.0,pp);',
    ' vec2 q=vec2(px.x/430.0,px.y/(430.0*sy*0.55))+vec2(t*0.010,0.0);',
    ' float f=fbm(q+vec2(0.0,t*0.004))+0.25*fbm(q*2.3-vec2(t*0.006,0.0));',
    ' return smoothstep(0.66,0.98,f);}',
    'void main(){',
    ' vec4 mk=texture2D(msk,v);float m=mk.r,s=mk.g;',
    ' vec2 px=v*vec2(W,H);',
    ' vec3 col=texture2D(tex,v).rgb;',
    // clouds: flow-map drift (two phases cross-faded) so they glide slowly to the right
    ' if(s>0.003){',
    '  float hgt=1.0-clamp(px.y/HZ,0.0,1.0);',
    '  vec2 fl=vec2(0.010+0.010*hgt,0.0);',
    '  float n=noise(px/90.0)*0.35;',
    '  float ph1=fract(t/9.0+n),ph2=fract(t/9.0+n+0.5);',
    '  vec3 c1=texture2D(tex,v-fl*ph1).rgb,c2=texture2D(tex,v-fl*ph2).rgb;',
    '  vec3 cc=mix(c1,c2,abs(1.0-2.0*ph1));',
    '  col=mix(col,cc,s);',
    ' }',
    // ocean: gentle perspective swell
    ' if(m>0.003&&px.y>HZ-4.0){',
    '  float d=max(px.y-HZ,0.0)+2.0;float Zw=F/d;float Xw=(px.x-CX)/d;float pp=clamp((px.y-HZ)/(H-HZ),0.0,1.0);',
    '  float sx=0.0,sz=0.0;',
    '  vec4 A[8];A[0]=vec4(0.40,-0.35,0.22,0.060);A[1]=vec4(0.29,0.25,0.32,0.055);A[2]=vec4(0.21,-0.60,0.38,0.050);',
    '  A[3]=vec4(0.155,0.52,0.46,0.045);A[4]=vec4(0.115,-0.15,0.56,0.040);A[5]=vec4(0.085,0.75,0.66,0.034);',
    '  A[6]=vec4(0.062,-0.85,0.78,0.028);A[7]=vec4(0.046,0.32,0.92,0.024);',
    '  for(int i=0;i<8;i++){vec4 w=A[i];float k=6.2831853/w.x;float dx=sin(w.y),dz=cos(w.y);',
    '   float fd=sm(2.0,6.0,w.x*d*d/F)*sm(2.0,6.0,w.x*d);',
    '   float c=cos(k*(dx*Xw+dz*Zw)+float(i)*2.399+6.2831853*w.z*t)*w.w*fd;sx+=c*dx;sz+=c*dz;}',
    '  float ay=0.5+3.2*pow(pp,1.1),ax=0.3+1.2*pow(pp,1.1);',
    '  vec2 q=v+vec2(ax*sx,ay*sz)/0.15*m/vec2(W,H);',
    '  vec3 wc=texture2D(tex,q).rgb;',
    '  wc*=1.0+0.07*(sz/0.15)*(0.35+0.65*pp);',
    '  float tilt=max(sz/0.15,0.0);float g=min(pow(max(tilt-0.9,0.0),2.0)*1.2,0.6)*(0.3+0.7*pp);',
    '  wc+=g*vec3(0.85,0.95,1.0)*0.35;',
    '  col=mix(col,wc,m);',
    ' }',
    // low clouds drifting slowly over the scene, with soft shadows on the sea and land
    ' float sh=cloud(px+vec2(-70.0,-95.0),t);float cl=cloud(px,t);',
    ' col*=1.0-0.20*sh*(1.0-cl);',
    ' vec3 cw=mix(vec3(0.86,0.90,0.96),vec3(1.0),smoothstep(0.0,1.0,cl));',
    ' col=mix(col,cw,cl*0.78);',
    ' gl_FragColor=vec4(min(col,1.0),1.0);}'
  ].join('\n');

  function start() {
    var cv = document.createElement('canvas');
    cv.className = img.className + ' sea-canvas';
    cv.setAttribute('aria-hidden', 'true');
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function texture(unit, source) {
      var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    try { texture(0, img); texture(1, buildMask()); } catch (e) { return; }
    if (gl.getError()) return;
    gl.uniform1i(gl.getUniformLocation(pr, 'tex'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'msk'), 1);
    var uT = gl.getUniformLocation(pr, 't'), uC = gl.getUniformLocation(pr, 'crop');

    img.parentNode.insertBefore(cv, img.nextSibling);
    var iw = img.naturalWidth, ih = img.naturalHeight, visible = true, raf = 0, t0 = performance.now();
    function size() {
      var r = img.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      var sc = Math.max(r.width / iw, r.height / ih), cw = r.width / sc / iw, ch = r.height / sc / ih;
      gl.uniform4f(uC, (1 - cw) / 2, (1 - ch) / 2, cw, ch);
    }
    function draw(now) {
      raf = 0; if (!visible || document.hidden) return;
      gl.uniform1f(uT, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!cv.classList.contains('is-on')) cv.classList.add('is-on');
      raf = requestAnimationFrame(draw);
    }
    function go() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); }
    size(); go();
    window.addEventListener('resize', function () { size(); go(); });
    document.addEventListener('visibilitychange', go);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; go(); }).observe(cv);
  }

  if (img.complete && img.naturalWidth) start();
  else img.addEventListener('load', start, { once: true });
})();
