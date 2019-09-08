// Particles: Particle effects shader.
attribute vec3 aPos;
attribute vec4 aRandom;
attribute vec4 aColor;

varying vec4 Color;

uniform mat4 ViewProjection;
uniform mat4 Model;
uniform float Time;

void main() {
  float time = max(0.0, Time - 3.0 * aRandom.w);
  vec3 v0 = aRandom.xyz + vec3(0.0, 0.0, 1.0);
  vec4 c1 = vec4(1.0, 0.0, 0.0, 1.0);
  vec4 c2 = vec4(0.0, 0.0, 0.0, 1.0);
  float frac = min(Time *0.333, aRandom.w);
  Color = mix(aColor, mix(c1, c2, frac), frac);
  gl_PointSize = 5.0;
  gl_Position = ViewProjection * Model * vec4(aPos + time * v0 - time * time * vec3(0.0, 0.0, 1.0), 1.0);
}
