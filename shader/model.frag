// Model: 3D shader with vertex colors, lighting, and normals.
precision lowp float;

varying vec4 Color;
varying vec3 Position, Normal;

void main() {
  vec3 norm = normalize(Normal);
  vec3 lighting = vec3(0.1, 0.2, 0.3) * (norm.z + 1.0) +
                  vec3(1.0, 0.8, 0.6) * max(dot(norm, vec3(0.6)), 0.0);
  gl_FragColor = Color * vec4(lighting, 1.0);
}
