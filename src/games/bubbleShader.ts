export interface ShaderBubble {
  x: number;
  y: number;
  radius: number;
  hue: number;
  bonus: boolean;
  popProgress: number;
}

export interface BubbleRenderer {
  render: (bubbles: ShaderBubble[], timeSeconds: number) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
}

const MAX_BUBBLES = 24;

const vertexShader = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_count;
uniform vec4 u_bubbles[${MAX_BUBBLES}];
uniform vec2 u_styles[${MAX_BUBBLES}];
out vec4 outColor;

vec3 spectrum(float value) {
  return 0.56 + 0.44 * cos(6.28318 * (value + vec3(0.00, 0.34, 0.67)));
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / u_resolution.x, 1.0 - gl_FragCoord.y / u_resolution.y);
  float aspect = u_resolution.x / u_resolution.y;
  vec3 color = vec3(1.0);

  for (int index = 0; index < ${MAX_BUBBLES}; index++) {
    if (index >= u_count) break;
    vec4 bubble = u_bubbles[index];
    vec2 style = u_styles[index];
    vec2 delta = (uv - bubble.xy) * vec2(aspect, 1.0);
    float dist = length(delta);
    float radius = bubble.z;
    float normalized = dist / max(radius, 0.0001);
    float angle = atan(delta.y, delta.x);
    float pop = bubble.w;

    float inside = 1.0 - smoothstep(0.93, 1.0, normalized);
    float fresnel = pow(clamp(normalized, 0.0, 1.0), 5.0);
    float rim = smoothstep(0.72, 1.0, normalized) * inside;
    float wave = style.x + normalized * 0.3 + angle * 0.055 + u_time * 0.018;
    vec3 iridescence = spectrum(wave);
    vec2 highlightCenter = vec2(-0.35, -0.38);
    float highlight = exp(-18.0 * dot(delta / radius - highlightCenter, delta / radius - highlightCenter));
    float lowerGlow = exp(-11.0 * dot(delta / radius - vec2(0.28, 0.34), delta / radius - vec2(0.28, 0.34)));

    float bodyAlpha = inside * (0.035 + fresnel * 0.18 + rim * 0.2);
    vec3 bodyColor = mix(vec3(0.83, 0.97, 1.0), iridescence, 0.52 + fresnel * 0.25);
    bodyColor += highlight * vec3(0.55) + lowerGlow * iridescence * 0.18;

    if (style.y > 0.5) {
      bodyColor = mix(bodyColor, vec3(1.0, 0.76, 0.2), 0.38);
      bodyAlpha += rim * 0.12;
    }

    if (pop >= 0.0) {
      float bodyFade = 1.0 - smoothstep(0.0, 0.2, pop);
      bodyAlpha *= bodyFade;
      float ringRadius = radius * (1.0 + pop * 0.72);
      float ring = exp(-abs(dist - ringRadius) / max(radius * 0.045, 0.001)) * (1.0 - pop);
      float fragments = step(0.54, sin(angle * 9.0 + style.x * 13.0) * 0.5 + 0.5);
      fragments *= exp(-abs(dist - ringRadius * 1.05) / max(radius * 0.12, 0.001));
      float burstAlpha = ring * 0.48 + fragments * (1.0 - pop) * 0.2;
      color = mix(color, iridescence, clamp(burstAlpha, 0.0, 0.75));
    }

    color = mix(color, bodyColor, clamp(bodyAlpha, 0.0, 0.58));
  }

  outColor = vec4(color, 1.0);
}`;

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create bubble shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message =
      gl.getShaderInfoLog(shader) || "Bubble shader compilation failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export function createBubbleRenderer(
  canvas: HTMLCanvasElement,
): BubbleRenderer | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const program = gl.createProgram();
  if (!program) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message =
      gl.getProgramInfoLog(program) || "Bubble shader linking failed.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const countLocation = gl.getUniformLocation(program, "u_count");
  const bubblesLocation = gl.getUniformLocation(program, "u_bubbles");
  const stylesLocation = gl.getUniformLocation(program, "u_styles");
  const bubbleValues = new Float32Array(MAX_BUBBLES * 4);
  const styleValues = new Float32Array(MAX_BUBBLES * 2);

  return {
    resize(width, height, pixelRatio) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    render(bubbles, timeSeconds) {
      bubbleValues.fill(0);
      styleValues.fill(0);
      const visible = bubbles.slice(0, MAX_BUBBLES);
      visible.forEach((bubble, index) => {
        bubbleValues.set(
          [bubble.x, bubble.y, bubble.radius, bubble.popProgress],
          index * 4,
        );
        styleValues.set([bubble.hue, bubble.bonus ? 1 : 0], index * 2);
      });
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, timeSeconds);
      gl.uniform1i(countLocation, visible.length);
      gl.uniform4fv(bubblesLocation, bubbleValues);
      gl.uniform2fv(stylesLocation, styleValues);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
