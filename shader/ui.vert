// UI: 2D textured shader.
attribute vec2 aPos;
attribute vec4 aColor;
attribute vec2 aTexCoord;

varying vec4 Color;
varying vec2 TexCoord;

uniform vec4 Scale;

void main() {
  Color = aColor;
  TexCoord = aTexCoord * Scale.zw;
  gl_Position = vec4(aPos * Scale.xy + vec2(-1.0, 1.0), 0.0, 1.0);
}
