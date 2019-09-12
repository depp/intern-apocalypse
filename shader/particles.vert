// Particles: Particle effects shader.
attribute vec3 aPos, aColor;
attribute vec4 aRandom;

varying vec3 Color;

uniform mat4 ViewProjection, Model;
uniform float Time, TimeDelay, ColorRate, Gravity;
uniform vec3 Colors[2], Velocity[2];

void main() {
  float time0 = aRandom.w * TimeDelay;
  float time = max(0.0, Time - time0);
  Color =
      mix(aColor,
          mix(Colors[0], Colors[1], clamp(time * ColorRate - 1.0, 0.0, 1.0)),
          min(time * ColorRate, 1.0));
  gl_PointSize = 5.0;
  gl_Position = ViewProjection * Model *
                vec4(aPos + time * (Velocity[0] + Velocity[1] * aRandom.xyz -
                                    time * Gravity * vec3(0.0, 0.0, 1.0)),
                     1.0);
}
