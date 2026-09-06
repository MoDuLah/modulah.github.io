(function() {
  const canvas = document.getElementById('shader-canvas-ANIMATION_67');
  let gl = null;

  function clearDarkFrame() {
    if (!gl) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0667, 0.0784, 0.0863, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function syncSize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    const drawingWidth = Math.round(w * pixelRatio);
    const drawingHeight = Math.round(h * pixelRatio);
    if (canvas.width !== drawingWidth || canvas.height !== drawingHeight) {
      canvas.width = drawingWidth;
      canvas.height = drawingHeight;
      clearDarkFrame();
      return true;
    }
    return false;
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  gl = canvas.getContext('webgl', { alpha: false }) || canvas.getContext('experimental-webgl', { alpha: false });
  if (!gl) return;
  const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_texCoord;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = v_texCoord;
    
    // Minimal deep charcoal base with transparency potential
    // We keep it dark but let the glow do the work
    vec3 color = vec3(0.02, 0.03, 0.04); 
    
    // Grid setup for data pulses
    vec2 grid = uv * vec2(50.0, 25.0);
    vec2 ipos = floor(grid);
    vec2 fpos = fract(grid);
    
    // Vertical "ghost" streams
    float speed = hash(vec2(ipos.x, 0.0)) * 0.3 + 0.1;
    float time = u_time * speed;
    float pulse = step(0.98, hash(ipos + floor(time * 2.0)));
    
    // Neon Green palette: #98f05f
    vec3 neon = vec3(0.596, 0.941, 0.373);
    
    // Subtle vertical movement
    float y_flow = fract(uv.y + time * 0.5);
    float trail = smoothstep(0.0, 0.3, y_flow) * (1.0 - y_flow);
    
    // Add very light, minimal atmospheric noise
    float n = hash(uv + u_time * 0.01);
    
    // Combine for a lightweight glow effect
    color += neon * trail * pulse * 0.15;
    color += neon * (1.0 - length(uv - 0.5)) * 0.02; // Soft center glow
    
    // Scanline detail
    float scanline = sin(uv.y * u_resolution.y * 0.8) * 0.01;
    color += scanline;
    
    // Alpha management: slightly transparent so it blends
    float alpha = 0.95; 

    gl_FragColor = vec4(color, alpha);
}`;
  function cs(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  const vertexShader = cs(gl.VERTEX_SHADER, vs);
  const fragmentShader = cs(gl.FRAGMENT_SHADER, fs);
  if (!vertexShader || !fragmentShader) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vertexShader);
  gl.attachShader(prog, fragmentShader);
  gl.linkProgram(prog);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return;
  }
  gl.useProgram(prog);
  clearDarkFrame();
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animationFrameId = null;

  function render(t) {
    animationFrameId = null;
    if (typeof ResizeObserver === 'undefined') syncSize();
    clearDarkFrame();
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!document.hidden && !reducedMotion.matches) {
      animationFrameId = requestAnimationFrame(render);
    }
  }
  render(0);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    } else if (!document.hidden && !reducedMotion.matches && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(render);
    }
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
      render(0);
    } else if (!document.hidden && animationFrameId === null) {
      animationFrameId = requestAnimationFrame(render);
    }
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  });
})();
