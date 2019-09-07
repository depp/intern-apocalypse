attribute vec3 aPos;
attribute vec4 aColor;
attribute vec2 aTexCoord;
attribute vec3 aNormal;

varying vec4 Color;
varying vec2 TexCoord;
varying vec3 Normal;

uniform mat4 ViewProjection;
uniform mat4 Model;

void main() {
  Color = aColor;
  TexCoord = aTexCoord;
  Normal = mat3(Model) * aNormal;
  gl_Position = ViewProjection * Model * vec4(aPos, 1.0);
}
