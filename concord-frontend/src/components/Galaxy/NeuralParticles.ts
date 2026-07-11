import * as THREE from 'three';

export class NeuralParticles {
  public points: THREE.Points;
  public lines: THREE.LineSegments;
  private count: number;
  private maxDist: number = 80;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lineGeometry: THREE.BufferGeometry;

  constructor(count: number) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 600;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 600;
      this.positions[i * 3 + 2] = -250 - Math.random() * 150;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.3;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const pointMaterial = new THREE.PointsMaterial({
      color: 0x0ea5e9,
      size: 3.5,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(pointGeometry, pointMaterial);

    this.lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending
    });

    this.lines = new THREE.LineSegments(this.lineGeometry, lineMaterial);
  }

  public update() {
    if (this.count === 0) return;

    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] += this.velocities[i * 3];
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1];
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2];

      if (Math.abs(this.positions[i * 3]) > 300) this.velocities[i * 3] *= -1;
      if (Math.abs(this.positions[i * 3 + 1]) > 300) this.velocities[i * 3 + 1] *= -1;
      if (this.positions[i * 3 + 2] > -100 || this.positions[i * 3 + 2] < -400) {
        this.velocities[i * 3 + 2] *= -1;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;

    const linePositions = [];
    for (let i = 0; i < this.count; i++) {
      const x1 = this.positions[i * 3];
      const y1 = this.positions[i * 3 + 1];
      const z1 = this.positions[i * 3 + 2];

      for (let j = i + 1; j < this.count; j++) {
        const x2 = this.positions[j * 3];
        const y2 = this.positions[j * 3 + 1];
        const z2 = this.positions[j * 3 + 2];

        const dist = Math.hypot(x1 - x2, y1 - y2, z1 - z2);
        if (dist < this.maxDist) {
          linePositions.push(x1, y1, z1, x2, y2, z2);
        }
      }
    }

    const lineVertices = new Float32Array(linePositions);
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
    this.lineGeometry.computeBoundingSphere();
  }

  public dispose() {
    this.points.geometry.dispose();
    if (Array.isArray(this.points.material)) {
      this.points.material.forEach(m => m.dispose());
    } else {
      this.points.material.dispose();
    }

    this.lines.geometry.dispose();
    if (Array.isArray(this.lines.material)) {
      this.lines.material.forEach(m => m.dispose());
    } else {
      this.lines.material.dispose();
    }
  }
}
