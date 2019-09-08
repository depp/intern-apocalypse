import {
  ShaderPrograms,
  Attribute,
  ShaderInfo,
  Program,
} from './shader.programs';
import { AssertionError } from '../src/debug/debug';
import { Shader } from './shader.syntax';

/** Map from long identifiers to short ones. */
class IdentifierMap {
  private readonly idmap = new Map<string, string>([['main', 'main']]);
  private readonly chars: string;
  private readonly data: number[] = [0];

  constructor() {
    let chars = '';
    for (const start of 'aA') {
      chars += String.fromCharCode(
        ...Array(26)
          .fill(0)
          .map((_, i) => i + start.charCodeAt(0)),
      );
    }
    chars += '_0123456789';
    this.chars = chars;
  }

  /** Add a long identifier to the minification map. */
  add(name: string): string {
    let short = this.idmap.get(name);
    if (short != null) {
      return short;
    }
    const { data, chars } = this;
    short = data.map(i => chars.charAt(i)).join('');
    this.idmap.set(name, short);
    let i = data.length - 1;
    while (i >= 0) {
      data[i]++;
      if ((i && data[i] < chars.length) || data[i] < chars.length - 10) {
        break;
      }
      data[i--] = 0;
    }
    if (i < 0) {
      data.unshift(0);
    }
    return short;
  }

  /** The map from old identifiers to new ones. */
  get map(): ReadonlyMap<string, string> {
    return this.idmap;
  }
}

interface ParsedShader {
  info: ShaderInfo;
  shader: Shader;
}

/**
 * Minify the shaders, removing whitespace and mangling identifiers.
 */
export function minifyShaders(shaderPrograms: ShaderPrograms): ShaderPrograms {
  const idmap = new IdentifierMap();

  // Generate new attribute names.
  for (const program of shaderPrograms.programs) {
    for (const attribute of program.attributes) {
      if (attribute != null) {
        idmap.add(attribute.glName);
      }
    }
  }

  // Parse all shaders and extract all identifiers.
  const uniforms = new Set<string>();
  const parsedShaders: ParsedShader[] = [];
  const identifierCounts = new Map<string, number>();
  const shaderUniforms = new Map<string, string[]>();
  for (const info of shaderPrograms.shaders.values()) {
    if (info == null) {
      throw new AssertionError('info == null');
    }
    const shader = new Shader(info.source);
    const decls = shader.listDeclarations();
    for (const name of decls.uniforms) {
      uniforms.add(name);
    }
    shaderUniforms.set(info.filename, decls.uniforms);
    for (const list of [decls.uniforms, decls.attributes, decls.locals]) {
      for (const name of list) {
        const count = identifierCounts.get(name);
        identifierCounts.set(name, count == null ? 1 : count + 1);
      }
    }
    parsedShaders.push({
      info: Object.assign({}, info, { uniforms }),
      shader,
    });
  }

  // Generate new uniform names.
  const uniformMap = new Map<string, string>();
  for (const name of Array.from(uniforms).sort()) {
    uniformMap.set(name, idmap.add(name));
  }

  // Generate new identifier names for other identifiers.
  const identList = Array.from(identifierCounts).sort((x, y) => {
    if (x[1] < y[1]) {
      return 1;
    } else if (x[1] > y[1]) {
      return -1;
    } else if (x[0] < y[0]) {
      return -1;
    } else if (x[0] > y[0]) {
      return 1;
    } else {
      return 0;
    }
  });
  for (const [name] of identList) {
    idmap.add(name);
  }

  // Create the minified shaders.
  const shaders = new Map<string, ShaderInfo>();
  for (let i = 0; i < parsedShaders.length; i++) {
    const { info, shader } = parsedShaders[i];
    info.source = shader.emitMinified(idmap.map);
    shaders.set(info.filename, info);
  }

  // Fill in uniforms and map attributes in the programs.
  const programs: Program[] = [];
  for (const program of shaderPrograms.programs) {
    const attributes: (Attribute | null)[] = [];
    for (const attribute of program.attributes) {
      if (attribute) {
        let short = idmap.map.get(attribute.glName);
        if (short == null) {
          throw new AssertionError('short == null', { attribute });
        }
        attributes.push({
          glName: short,
          enumName: attribute.enumName,
        });
      } else {
        attributes.push(null);
      }
    }
    const programUniforms = new Set<string>();
    for (const filename of [program.vertex, program.fragment]) {
      const uniforms = shaderUniforms.get(filename);
      if (uniforms == null) {
        throw new AssertionError('uniforms == null', { filename });
      }
      for (const name of uniforms) {
        const short = idmap.map.get(name);
        if (short == null) {
          throw new AssertionError('short == null', { name });
        }
        programUniforms.add(short);
      }
    }
    const uniforms = Array.from(programUniforms).sort();
    programs.push(Object.assign({}, program, { attributes, uniforms }));
  }

  return {
    programs,
    shaders,
    uniformMap,
  };
}
