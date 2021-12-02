/*
  Copyright 2017 Google Inc. All Rights Reserved.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
      http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const BASE_VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;

varying vec2 texCoords;

void main() {
  gl_Position = vec4(position, 0, 1.0);
  texCoords = uv;
}`;

const BASE_FRAGMENT_SHADERX = `
precision highp float;

varying vec2 texCoords;

uniform sampler2D textureSampler;

void main() {
  gl_FragColor = texture2D(textureSampler, texCoords);
  gl_FragColor = vec4(1.0 - gl_FragColor.r,1.0 -gl_FragColor.g,1.0 -gl_FragColor.b,1);
}`;

const BASE_FRAGMENT_SHADER = `
precision highp float;
varying vec2 texCoords;
uniform vec2 size;
uniform sampler2D textureSampler;
#define FSR_RCAS_LIMIT (0.25-(1.0/16.0))
vec4 FsrRcasLoadF(vec2 p);
void FsrRcasCon(
    out float con,
    float sharpness
){
    con = exp2(-sharpness);
}

vec3 FsrRcasF(
    vec2 ip,
    float con
)
{
    vec2 sp = vec2(ip);
    vec3 b = FsrRcasLoadF(sp + vec2( 0,-1)).rgb;
    vec3 d = FsrRcasLoadF(sp + vec2(-1, 0)).rgb;
    vec3 e = FsrRcasLoadF(sp).rgb;
    vec3 f = FsrRcasLoadF(sp+vec2( 1, 0)).rgb;
    vec3 h = FsrRcasLoadF(sp+vec2( 0, 1)).rgb;
    float bL = b.g + .5 * (b.b + b.r);
    float dL = d.g + .5 * (d.b + d.r);
    float eL = e.g + .5 * (e.b + e.r);
    float fL = f.g + .5 * (f.b + f.r);
    float hL = h.g + .5 * (h.b + h.r);
    float nz = .25 * (bL + dL + fL + hL) - eL;
    nz=clamp(
        abs(nz)
        /(
            max(max(bL,dL),max(eL,max(fL,hL)))
            -min(min(bL,dL),min(eL,min(fL,hL)))
        ),
        0., 1.
    );
    nz=1.-.5*nz;
    vec3 mn4 = min(b, min(f, h));
    vec3 mx4 = max(b, max(f, h));
    vec2 peakC = vec2(1., -4.);
    vec3 hitMin = mn4 / (4. * mx4);
    vec3 hitMax = (peakC.x - mx4) / (4.* mn4 + peakC.y);
    vec3 lobeRGB = max(-hitMin, hitMax);
    float lobe = max(
        -FSR_RCAS_LIMIT,
        min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.)
    )*con;
    #ifdef FSR_RCAS_DENOISE
    lobe *= nz;
    #endif
    return (lobe * (b + d + h + f) + e) / (4. * lobe + 1.);
} 


vec4 FsrRcasLoadF(vec2 p) {
    return texture2D(textureSampler, p/size);
}

void main(void)
{
    float con;
    float sharpness = 0.2;
    FsrRcasCon(con,sharpness);
    vec3 col = FsrRcasF(texCoords * size, con);
    gl_FragColor = vec4(col, texture2D(textureSampler, texCoords).a);
}`;

const POSITIONS = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
const UVS = new Float32Array([0, 1, 0, 0, 1, 0, 1, 1]);
const INDEX = new Uint16Array([0, 1, 2, 0, 2, 3]);

class UniformInfo {
  type: GLenum;
  location: WebGLUniformLocation;
}

class ImageShader {
  canvas: HTMLCanvasElement;
  context: WebGLRenderingContext;

  private textureId: WebGLTexture;
  private programId: WebGLProgram;
  private vertShader: string;
  private fragShader: string;

  private uniformLocations: Map<string, UniformInfo>;
  private dirtyProgram: boolean;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('webgl');

    if (context === null) {
      throw new Error(`Couldn't get a WebGL context`);
    }

    const gl: WebGLRenderingContext = context as WebGLRenderingContext;
    this.context = gl;
    const textureId = gl.createTexture();

    if (textureId === null) {
      throw new Error('Error getting texture ID');
    }

    this.textureId = textureId;
    this.programId = 0;

    this.vertShader = BASE_VERTEX_SHADER;
    this.fragShader = BASE_FRAGMENT_SHADER;

    this.uniformLocations = new Map();

    this.bindBuffers(INDEX, POSITIONS, UVS);

    gl.clearColor(1, 1, 1, 1);

    this.dirtyProgram = true;
  }

  setImage(image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
    const gl = this.context;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textureId);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    // gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


    let scale = window.devicePixelRatio;
    let realWidth = image.clientWidth * scale;
    let realHeight = image.clientHeight * scale;

    if (image instanceof HTMLVideoElement) {
        if (image.videoWidth < realWidth || image.videoHeight < realHeight) {
            this.setUniform("size", new Float32Array([realWidth, realHeight]));
        } else {
            this.setUniform("size", new Float32Array([image.videoWidth, image.videoHeight]));
        }
    }
    else {
        if (image.width < realWidth || image.height < realHeight) {
            this.setUniform("size", new Float32Array([realWidth, realHeight]));
        } else {
            this.setUniform("size", new Float32Array([image.width, image.height]));
        }
    }
    this.canvas.width = image.width;
    this.canvas.height = image.height;
  }

  setVertexShader(source: string) {
    this.vertShader = source;
    this.dirtyProgram = true;
  }

  setFragmentShader(source: string) {
    this.fragShader = source;
    this.dirtyProgram = true;
  }

  setUniform(name: string, value: any) {
    const gl = this.context;

    if (this.dirtyProgram) {
      this.createProgram();
    }

    if (!this.uniformLocations.has(name)) {
      console.warn(`Tried to set unknown uniform ${name}`);
      return;
    }

    const info = this.uniformLocations.get(name)!;

    switch (info.type) {
      case gl.FLOAT:
        gl.uniform1fv(info.location, [value]);
        break;
      case gl.FLOAT_VEC2:
        gl.uniform2fv(info.location, value);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(info.location, value);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(info.location, value);
        break;
      case gl.BOOL:
      case gl.INT:
        gl.uniform1iv(info.location, [value]);
        break;
      case gl.BOOL_VEC2:
      case gl.INT_VEC2:
        gl.uniform2iv(info.location, value);
        break;
      case gl.BOOL_VEC3:
      case gl.INT_VEC3:
        gl.uniform3iv(info.location, value);
        break;
      case gl.BOOL_VEC4:
      case gl.INT_VEC4:
        gl.uniform4iv(info.location, value);
        break;
      default:
        console.error(`Couldn't set uniform, unsupported type`);
    }
  }

  render() {
    const gl = this.context;

    if (this.dirtyProgram) {
      this.createProgram();
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.flush();
  }

  private createProgram() {
    const gl = this.context;

    const vertexShaderId = this.compileShader(this.vertShader, gl.VERTEX_SHADER);
    const fragmentShaderId = this.compileShader(this.fragShader, gl.FRAGMENT_SHADER);
    const programId = gl.createProgram();
    if (programId === null) {
      throw new Error(`Couldn't get a program ID`);
    }
    this.programId = programId;
    gl.attachShader(programId, vertexShaderId);
    gl.attachShader(programId, fragmentShaderId);
    gl.linkProgram(programId);
    if (!gl.getProgramParameter(programId, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(programId);
      throw new Error('Could not link shader program. \n\n' + info);
    }
    gl.validateProgram(programId);
    if (!gl.getProgramParameter(programId, gl.VALIDATE_STATUS)) {
      const info = gl.getProgramInfoLog(programId);
      throw new Error('Could not validate shader program. \n\n' + info);
    }
    gl.useProgram(programId);
    this.uniformLocations = new Map();
    this.getUniformLocations();

    this.dirtyProgram = false;
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.context;
    const shader = gl.createShader(type);

    if (shader === null) {
      throw new Error('Error creating shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Couldn't compiler shader: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  private getUniformLocations() {
    const gl = this.context;
    const numUniforms = gl.getProgramParameter(this.programId, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(this.programId, i);
      if (info === null) {
        throw new Error(`Couldn't get uniform info`);
      }
      const location = gl.getUniformLocation(this.programId, info.name);
      if (location) {
        this.uniformLocations.set(info.name, {type: info.type, location});
      }
    }
  }

  private bindBuffers(index: Uint16Array, positions: Float32Array, uvs: Float32Array) {
    const gl = this.context;
    this.bindIndicesBuffer(index);
    this.bindAttributeBuffer(0, 2, positions);
    this.bindAttributeBuffer(1, 2, uvs);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
  }

  private bindAttributeBuffer(attributeNumber: number, size: number, data: Float32Array) {
    const gl = this.context;
    const id = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, id);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(attributeNumber, size, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private bindIndicesBuffer(data: Uint16Array) {
    const gl = this.context;
    const id = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, id);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  public destroy() {
      const gl = this.context;
      gl.getExtension("WEBGL_lose_context").loseContext();
  }
}