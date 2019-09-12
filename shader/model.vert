// Model: 3D shader with vertex colors, lighting, and normals.
attribute vec3 aPos;
attribute vec4 aColor;
attribute vec3 aNormal;

varying vec4 Color;
varying vec3 Position, Normal;

uniform mat4 ViewProjection;
uniform mat4 Model;

void main() {
  vec4 pos = Model * vec4(aPos, 1.0);
  Color = aColor;
  Position = pos.xyz;
  Normal = mat3(Model) * aNormal;
  gl_Position = ViewProjection * pos;
}
