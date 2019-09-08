// Model: 3D shader with vertex colors, lighting, and normals.
precision lowp float;

varying vec4 Color;
varying vec3 Normal;

float evaluate_light(vec3 dir) {
  return max(dot(Normal, dir) / length(dir), 0.0);
}

void main() {
  vec3 lighting = vec3(0.0);
  lighting += vec3(0.6, 0.8, 1.0) * evaluate_light(vec3(0.0, 0.0, 1.0));
  lighting += vec3(0.6, 0.4, 0.2) * evaluate_light(vec3(0.0, 0.0, -1.0));
  gl_FragColor = Color * vec4(lighting, 1.0);
}
