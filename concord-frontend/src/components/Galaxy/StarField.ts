import * as THREE from 'three';

export class StarField {
  public points: THREE.Points;

  constructor(count: number, size: number, color: string, zRange: number) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i * 3 + 2] = (Math.random() - 0.5) * zRange - 200;
      opacities[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uColor: { value: new THREE.Color(color) }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (350.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vOpacity;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          
          // Twinkling animation logic
          float twinkle = sin(uTime * 2.5 + vOpacity * 100.0) * 0.3 + 0.7;
          float alpha = (1.0 - dist * 2.0) * (vOpacity * 0.6 + 0.4) * twinkle;
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });

    this.points = new THREE.Points(geometry, material);
  }

  public update(time: number) {
    if (this.points.material instanceof THREE.ShaderMaterial) {
      this.points.material.uniforms.uTime.value = time;
    }
  }

  public dispose() {
    this.points.geometry.dispose();
    if (Array.isArray(this.points.material)) {
      this.points.material.forEach(m => m.dispose());
    } else {
      this.points.material.dispose();
    }
  }
}
