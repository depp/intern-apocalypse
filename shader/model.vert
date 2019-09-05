attribute vec3 aPos;
attribute vec4 aColor;
attribute vec3 aNormal;

varying vec4 Color;
varying vec3 Normal;

uniform mat4 ViewProjection;
uniform mat4 Model;

void main() {
  Color = aColor;
  Normal = mat3(Model) * aNormal;
  gl_Position = ViewProjection * Model * vec4(aPos, 1.0);
}
