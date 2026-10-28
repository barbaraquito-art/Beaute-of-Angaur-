/* Home hero: the sea moves. A small WebGL shader ripples only the water in the
   sunset photo (sky, cliffs, beach and boats stay still). Falls back to the
   still photo when WebGL is missing or the visitor prefers reduced motion. */
(function () {
  var img = document.querySelector('[data-sea-hero]');
  if (!img) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Water outline in image coordinates (0..1), traced from the photo.
  var POLY = [[1080,409],[500,409],[420,416],[410,432],[330,438],[250,438],[205,452],[208,478],[160,495],[125,508],[100,522],[115,540],[160,575],[220,615],[290,655],[360,690],[420,720],[1080,720]];
  // Boats stay still: [x, y, rx, ry] in the same 1080x720 space.
  var BOATS = [[285,508,22,9],[327,516,22,9],[244,537,28,10],[393,557,34,12],[322,599,48,16]];

  function buildMask() {
    var w = 540, h = 360, s = w / 1080;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.beginPath();
    POLY.forEach(function (p, i) { i ? g.lineTo(p[0] * s, p[1] * s) : g.moveTo(p[0] * s, p[1] * s); });
    g.closePath(); g.fill();
    g.fillStyle = '#000';
    BOATS.forEach(function (b) { g.beginPath(); g.ellipse(b[0] * s, b[1] * s, b[2] * s * 1.15, b[3] * s * 1.25, 0, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#000'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(262 * s, 613 * s); g.lineTo(290 * s, 603 * s); g.stroke();
    // soften the edges (works without ctx.filter): shrink then enlarge with smoothing
    var t = document.createElement('canvas'); t.width = w / 6; t.height = h / 6;
    var tg = t.getContext('2d'); tg.imageSmoothingEnabled = true; tg.drawImage(c, 0, 0, t.width, t.height);
    var o = document.createElement('canvas'); o.width = w; o.height = h;
    var og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(c, 0, 0); og.globalAlpha = 0.65; og.drawImage(t, 0, 0, w, h);
    return o;
  }

  var VS = 'attribute vec2 p;varying vec2 v;uniform vec4 crop;void main(){v=vec2(crop.x+(p.x*0.5+0.5)*crop.z,crop.y+(0.5-p.y*0.5)*crop.w);gl_Position=vec4(p,0.0,1.0);}';
  var FS = [
    'precision highp float;varying vec2 v;uniform sampler2D tex,msk;uniform float t;',
    'const float W=1440.0,H=960.0,HZ=546.0,F=700.0,CX=892.8,SUN=1345.0;',
    'float sm(float a,float b,float x){float k=clamp((x-a)/(b-a),0.0,1.0);return k*k*(3.0-2.0*k);}',
    'void main(){',
    ' vec2 px=v*vec2(W,H);float m=texture2D(msk,v).r;',
    ' if(px.y<HZ-2.0||m<0.002){gl_FragColor=texture2D(tex,v);return;}',
    ' float d=max(px.y-HZ,0.0)+1.5;float Zw=F/d;float Xw=(px.x-CX)/d;float pp=clamp((px.y-HZ)/(H-HZ),0.0,1.0);',
    ' float sx=0.0,sz=0.0;',
    ' vec4 A[9];A[0]=vec4(0.42,-0.30,0.25,0.060);A[1]=vec4(0.31,0.22,0.375,0.055);A[2]=vec4(0.23,-0.55,0.375,0.050);',
    ' A[3]=vec4(0.17,0.48,0.5,0.045);A[4]=vec4(0.125,-0.12,0.625,0.040);A[5]=vec4(0.092,0.70,0.75,0.035);',
    ' A[6]=vec4(0.068,-0.80,0.875,0.030);A[7]=vec4(0.050,0.30,1.0,0.026);A[8]=vec4(0.037,-0.40,1.25,0.022);',
    ' for(int i=0;i<9;i++){vec4 w=A[i];float k=6.2831853/w.x;float dx=sin(w.y),dz=cos(w.y);',
    '  float fd=sm(2.5,7.0,w.x*d*d/F)*sm(2.5,7.0,w.x*d);',
    '  float c=cos(k*(dx*Xw+dz*Zw)+float(i)*2.399+6.2831853*w.z*t)*w.w*fd;sx+=c*dx;sz+=c*dz;}',
    ' float ay=0.6+5.0*pow(pp,1.2),ax=0.3+1.6*pow(pp,1.2);',
    ' vec2 q=v+vec2(ax*sx,ay*sz)/0.15*m/vec2(W,H);',
    ' vec3 col=texture2D(tex,q).rgb;',
    ' col*=1.0+0.10*(sz/0.15)*m*(0.3+0.7*pp);',
    ' float path=exp(-pow((px.x-(SUN-(px.y-HZ)*0.30))/(60.0+380.0*pp),2.0));',
    ' vec3 base=texture2D(tex,v).rgb;float warm=clamp((base.r-base.b)*255.0/110.0-60.0/110.0,0.0,1.0);',
    ' float gw=clamp(0.7*path+0.3*warm*sqrt(path),0.0,1.0)*m;',
    ' float tilt=max(sz/0.15,0.0);float g=min(pow(max(tilt-0.85,0.0),2.0)*gw*2.6,1.0);',
    ' col+=g*vec3(1.0,0.882,0.667)*0.85;',
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
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
      // same crop as object-fit: cover, centred
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
