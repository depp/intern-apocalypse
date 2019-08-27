attribute vec3 aPos;
attribute vec4 aColor;

varying vec4 Color;

uniform mat4 ModelViewProjection;

void main() {
  Color = aColor;
  gl_Position = ModelViewProjection * vec4(aPos, 1.0);
}
