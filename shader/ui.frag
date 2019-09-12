// UI: 2D textured shader.
precision mediump float;

varying vec4 Color;
varying vec2 TexCoord;

uniform sampler2D Texture;

void main() {
  gl_FragColor = texture2D(Texture, TexCoord) * (Color + vec4(0.5));
}
