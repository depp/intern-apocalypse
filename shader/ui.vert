// UI: 2D textured shader.
attribute vec2 aPos;
attribute vec4 aColor;
attribute vec2 aTexCoord;

varying vec4 Color;
varying vec2 TexCoord;

uniform mat4 ModelViewProjection;

void main() {
  Color = aColor;
  TexCoord = aTexCoord;
  gl_Position = ModelViewProjection * vec4(aPos, 0.0, 1.0);
}
