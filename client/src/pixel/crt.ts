// The CRT look: one WebGL2 fragment pass that takes the low-res game canvas and draws it to the screen
// canvas with curvature, scanlines, an aperture mask, soft bloom, a tiny RGB split and a vignette.
// Everything is drawn crisp first; this is the only place the image gets "analog". `strength` 0 = clean
// nearest-neighbour pixels (the setting toggle), 1 = full effect.

const VERT = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 uv;
out vec4 o;
uniform sampler2D src;
uniform vec2 srcSize;   // low-res size in pixels
uniform vec2 outSize;   // screen size in pixels
uniform float k;        // strength 0..1

vec2 curve(vec2 u) {
  u = u * 2.0 - 1.0;
  vec2 off = abs(u.yx) / vec2(7.0, 5.5);
  u = u + u * off * off * k;
  return u * 0.5 + 0.5;
}

vec3 tap(vec2 u) {
  // Sharp pixels with a soft edge one screen pixel wide, so integer and non-integer scales both look clean.
  vec2 px = u * srcSize;
  vec2 c = floor(px) + 0.5;
  vec2 f = px - c;
  vec2 s = outSize / srcSize;
  c += clamp(f * s, -0.5, 0.5);
  return texture(src, c / srcSize).rgb;
}

void main() {
  vec2 u = mix(uv, curve(uv), k);
  if (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) { o = vec4(0.02, 0.02, 0.03, 1.0); return; }
  float ca = 0.35 * k / srcSize.x;
  vec3 col = vec3(tap(u + vec2(ca, 0.0)).r, tap(u).g, tap(u - vec2(ca, 0.0)).b);
  // Bloom: a cheap 8-tap blur of the source added on top, brights bleed a little.
  vec3 b = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    b += texture(src, u + vec2(cos(a), sin(a)) * 1.6 / srcSize).rgb;
  }
  b /= 8.0;
  col += max(b - 0.55, 0.0) * 0.55 * k;
  // Scanlines at the low-res row pitch; dark rows dim less on bright pixels so highlights stay bright.
  float row = fract(u.y * srcSize.y);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float scan = mix(1.0, 0.72 + 0.28 * lum, k * smoothstep(0.25, 0.5, abs(row - 0.5)));
  col *= clamp(scan, 0.0, 1.0);
  // Aperture mask: faint RGB stripes per screen column.
  int m = int(mod(gl_FragCoord.x, 3.0));
  vec3 mask = m == 0 ? vec3(1.0, 0.92, 0.92) : m == 1 ? vec3(0.92, 1.0, 0.92) : vec3(0.92, 0.92, 1.0);
  col *= mix(vec3(1.0), mask, 0.6 * k);
  // Vignette + a touch of brightness back so the overall level matches the clean image.
  vec2 v = uv * (1.0 - uv.yx);
  col *= mix(1.0, pow(16.0 * v.x * v.y, 0.18), k);
  col *= 1.0 + 0.12 * k;
  o = vec4(col, 1.0);
}`;

export interface Presenter {
  present(src: HTMLCanvasElement, strength: number): void;
  readonly gl: boolean;
}

// WebGL2 when available; otherwise the canvas is simply scaled by the browser (pixelated CSS).
export function makePresenter(out: HTMLCanvasElement): Presenter {
  // preserveDrawingBuffer: screenshots and demo capture read the last frame.
  const gl = out.getContext("webgl2", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return fallback(out);
  const prog = link(gl);
  if (!prog) return fallback(out);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
  for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
  const uSrcSize = gl.getUniformLocation(prog, "srcSize");
  const uOutSize = gl.getUniformLocation(prog, "outSize");
  const uK = gl.getUniformLocation(prog, "k");
  return {
    gl: true,
    present(src, strength) {
      gl.viewport(0, 0, out.width, out.height);
      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform2f(uSrcSize, src.width, src.height);
      gl.uniform2f(uOutSize, out.width, out.height);
      gl.uniform1f(uK, strength);
      const filter = strength ? gl.LINEAR : gl.NEAREST; // clean: plain nearest-neighbour pixels
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, filter);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

function link(gl: WebGL2RenderingContext): WebGLProgram | null {
  const sh = (type: number, code: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, code);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("[crt]", gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("[crt] link failed", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function fallback(out: HTMLCanvasElement): Presenter {
  const ctx = out.getContext("2d")!;
  return {
    gl: false,
    present(src) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, 0, 0, out.width, out.height);
    },
  };
}
