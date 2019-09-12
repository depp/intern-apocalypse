import { watchFile } from './files';
import { ShaderError, compileShader, ShaderSpec } from '../render/shader';
import { getShaderSpecs } from '../render/shaders';
import { hashVariables } from './hash';

interface Shader {
  spec: ShaderSpec;
  isDirty: boolean;
  vertexSource: string | null;
  fragmentSource: string | null;
}

/** Update a single shader after files have been updated. */
function updateShader(shader: Shader): void {
  if (!shader.isDirty) {
    return;
  }
  shader.isDirty = false;
  const { spec, vertexSource, fragmentSource } = shader;
  if (!vertexSource || !fragmentSource) {
    return;
  }
  if (hashVariables.logAssets) {
    console.log(`Loading shader ${spec.name}`);
  }
  try {
    compileShader(
      spec.object,
      spec.uniforms,
      spec.attributes,
      vertexSource,
      fragmentSource,
      spec.name,
    );
  } catch (e) {
    if (e instanceof ShaderError) {
      console.error(
        `Could not compile ${spec.name}}: ${e.message}\n` + e.infoLog,
      );
    }
  }
}

/** Mark a shader as dirty and schedule it to be recompiled. */
function markDirty(shader: Shader): void {
  shader.isDirty = true;
  setTimeout(() => updateShader(shader));
}

function watchShader(spec: ShaderSpec): void {
  const prefix = 'shader/';
  // Fill in unloaded version of shader.
  const { object, uniforms } = spec;
  object.program = null;
  for (const name of uniforms) {
    object[name] = null;
  }
  const shader: Shader = {
    spec,
    isDirty: false,
    vertexSource: null,
    fragmentSource: null,
  };
  watchFile(prefix + spec.vertex, data => {
    if (data != shader.vertexSource) {
      shader.vertexSource = data;
      markDirty(shader);
    }
  });
  watchFile(prefix + spec.fragment, data => {
    if (data != shader.fragmentSource) {
      shader.fragmentSource = data;
      markDirty(shader);
    }
  });
}

/** Compile shaders from data files received over the web socket. */
export function watchShaders(): void {
  for (const spec of getShaderSpecs()) {
    watchShader(spec);
  }
}
