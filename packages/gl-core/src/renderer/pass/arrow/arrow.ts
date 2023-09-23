import {
  Program,
  Renderer,
  Mesh,
  Geometry,
  Texture,
  utils,
  Vector2,
} from '@sakitam-gis/vis-engine';
import Pass from '../base';
import { littleEndian } from '../../../utils/common';
import vert from '../../../shaders/common.vert.glsl';
import frag from '../../../shaders/arraw.frag.glsl';
import * as shaderLib from '../../../shaders/shaderLib';
import { BandType } from '../../../type';
import { SourceType } from '../../../source';

export interface ArrowPassOptions {
  source: SourceType;
  texture: Texture;
  textureNext: Texture;
  bandType: BandType;
  getPixelsToUnits: () => [number, number];
}

/**
 * arrow
 */
export default class ArrowPass extends Pass<ArrowPassOptions> {
  #program: WithNull<Program>;
  #mesh: WithNull<Mesh>;
  #geometry: WithNull<Geometry>;

  private lastDataBounds: number[];
  private lastPixelsToUnits: [number, number];

  readonly prerender = false;

  constructor(id: string, renderer: Renderer, options: ArrowPassOptions = {} as ArrowPassOptions) {
    super(id, renderer, options);

    this.#program = new Program(renderer, {
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        opacity: {
          value: 1,
        },
        u_fade_t: {
          value: 0,
        },
        displayRange: {
          value: new Vector2(-Infinity, Infinity),
        },
        u_texture: {
          value: this.options.texture,
        },
        u_textureNext: {
          value: this.options.textureNext,
        },
        colorRampTexture: {
          value: null,
        },
      },
      defines: [`RENDER_TYPE ${this.options.bandType}`, `LITTLE_ENDIAN ${littleEndian}`],
      includes: shaderLib,
      transparent: true,
    });

    this.#geometry = new Geometry(renderer, {
      position: {
        size: 2,
        data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      },
      uv: {
        size: 2,
        data: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      },
      index: {
        size: 1,
        data: new Uint16Array([0, 1, 2, 2, 1, 3]),
      },
    });

    this.#mesh = new Mesh(renderer, {
      mode: renderer.gl.TRIANGLES,
      program: this.#program,
      geometry: this.#geometry,
    });
  }

  /**
   * @param rendererParams
   * @param rendererState
   */
  render(rendererParams, rendererState) {
    const attr = this.renderer.attributes;
    this.renderer.setViewport(this.renderer.width * attr.dpr, this.renderer.height * attr.dpr);
    const camera = rendererParams.cameras.camera;
    if (rendererState && this.#mesh) {
      const uniforms = utils.pick(rendererState, [
        'opacity',
        'colorRange',
        'dataRange',
        'colorRampTexture',
        'useDisplayRange',
        'displayRange',
      ]);

      const dataBounds = rendererState.sharedState.u_data_bbox;
      const pixelsToUnits = this.options.getPixelsToUnits();

      if (
        dataBounds &&
        pixelsToUnits &&
        (JSON.stringify(dataBounds) !== JSON.stringify(this.lastDataBounds) ||
          JSON.stringify(pixelsToUnits) !== JSON.stringify(this.lastPixelsToUnits))
      ) {
        const { symbolSize, symbolSpace } = rendererState;
        const symbolSizeX = pixelsToUnits[0] * symbolSize;
        const symbolSizeY = pixelsToUnits[1] * symbolSize;

        const symbolSpaceX = pixelsToUnits[0] * symbolSpace;
        const symbolSpaceY = pixelsToUnits[1] * symbolSpace;
        // 需要考虑图形大小，图形间隔，计算当前视图下所分布的格网数据
        const cols = Math.floor((dataBounds[2] - dataBounds[0]) / (symbolSpaceX + symbolSizeX)); // 列
        const rows = Math.floor((dataBounds[1] - dataBounds[3]) / (symbolSpaceY + symbolSizeY)); // 行
        const points = new Float32Array(cols * rows * 2);
        let k = 0;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            // points[k] = dataBounds[0] + (symbolSpaceX + symbolSizeX) * i;
            points.set(
              [
                dataBounds[0] + (symbolSpaceX + symbolSizeX) * i,
                dataBounds[3] + (symbolSpaceY + symbolSizeY) * j,
              ],
              2 * k,
            );
            k++;
          }
        }

        console.log(points);
        this.#geometry?.setAttributeData('position', points);
      }

      Object.keys(uniforms).forEach((key) => {
        if (uniforms[key] !== undefined) {
          this.#mesh?.program.setUniform(key, uniforms[key]);
        }
      });

      const fade = this.options.source?.getFadeTime?.() || 0;
      this.#mesh.program.setUniform(
        'u_image_res',
        new Vector2(this.options.texture.width, this.options.texture.height),
      );
      this.#mesh.program.setUniform('u_fade_t', fade);

      this.#mesh.updateMatrix();
      this.#mesh.worldMatrixNeedsUpdate = false;
      this.#mesh.worldMatrix.multiply(camera.worldMatrix, this.#mesh.localMatrix);
      this.#mesh.draw({
        ...rendererParams,
        camera,
      });
    }
  }

  destroy() {
    if (this.#mesh) {
      this.#mesh.destroy();
      this.#mesh = null;
    }

    if (this.#program) {
      this.#program.destroy();
      this.#program = null;
    }

    if (this.#geometry) {
      this.#geometry.destroy();
      this.#geometry = null;
    }
  }
}