/** Game canvas element. */
const canvas = document.getElementById('g') as HTMLCanvasElement;
/** WebGL rendering context. */
const gl = canvas.getContext('webgl', { alpha: false })!;

if (!gl) {
  throw new Error('Could not create WebGL context');
}

/** Compile a WebGL shader. */
function compileShader(type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!; // FIXME: check?
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      'Failed to compile shader.\n' + gl.getShaderInfoLog(shader),
    );
  }
  return shader;
}

/** Compile and link a WebGL program. */
function compileProgram(
  attrs: ReadonlyArray<string>,
  vertex: WebGLShader,
  fragment: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()!; // FIXME: check?
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      'Failed to link shader program.\n' + gl.getProgramInfoLog(program),
    );
  }
  return program;
}

const vshader = compileShader(
  gl.VERTEX_SHADER,
  `
attribute vec2 pos;
void main() {
    gl_Position = vec4(pos, 0.0, 1.0);
}
`,
);

const fshader = compileShader(
  gl.FRAGMENT_SHADER,
  `
void main() {
    gl_FragColor = vec4(1.0);
}
`,
);

const prog = compileProgram(['pos'], vshader, fshader);
const buf = gl.createBuffer()!; // FIXME: check?
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]),
  gl.STATIC_DRAW,
);

gl.clearColor(0, 0.6, 0.9, 0);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.useProgram(prog);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.drawArrays(gl.TRIANGLES, 0, 3);
