import { getFile, watchFiles } from './files';
import { ShaderError, compileShader, ShaderSpec } from '../render/shader';
import { getShaderSpecs } from '../render/shaders';
import { gl } from '../lib/global';

enum State {
  Empty,
  Ok,
  Error,
}

interface Shader {
  spec: ShaderSpec;
  state: State;
  version: number;
}

const shaders: Shader[] = [];

const prefix = 'shader/';

/** Update a single shader after files have been updated. */
function update(shader: Shader): void {
  const vertex = getFile(prefix + shader.spec.vertex);
  const fragment = getFile(prefix + shader.spec.fragment);
  if (!vertex.data || !fragment.data) {
    return;
  }
  const version = Math.max(vertex.version, fragment.version);
  if (version == shader.version) {
    return;
  }
  let prog: any;
  try {
    prog = compileShader(
      shader.spec.uniforms,
      shader.spec.attributes,
      vertex.data,
      fragment.data,
      shader.spec.name,
    );
  } catch (e) {
    if (e instanceof ShaderError) {
      console.error(
        `Could not compile ${shader.spec.name}}: ${e.message}\n` + e.infoLog,
      );
    }
    shader.state = State.Error;
    shader.version = version;
    return;
  }
  const oldProg = shader.spec.object.program;
  if (oldProg) {
    gl.deleteProgram(oldProg);
  }
  Object.assign(shader.spec.object, prog);
  shader.state = State.Ok;
  shader.version = version;
}

/** Respond to files being received over the web socket. */
function filesChanged(): void {
  for (const shader of shaders) {
    update(shader);
  }
}

/** Compile shaders from data files received over the web socket. */
export function watchShaders(): void {
  for (const spec of getShaderSpecs()) {
    shaders.push({
      spec,
      state: State.Empty,
      version: 0,
    });
  }
  watchFiles(filesChanged);
}
