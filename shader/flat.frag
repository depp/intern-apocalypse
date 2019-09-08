// Flat-shaded (no lighting) fragemnt shader.
precision lowp float;

varying vec4 Color;
varying vec2 TexCoord;

uniform sampler2D Texture;

void main() {
  gl_FragColor = texture2D(Texture, TexCoord) * Color;
}
