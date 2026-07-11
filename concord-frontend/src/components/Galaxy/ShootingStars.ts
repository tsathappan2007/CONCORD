import * as THREE from 'three';

interface ShootingStarData {
  mesh: THREE.Line;
  speed: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ShootingStars {
  public group: THREE.Group;
  private stars: ShootingStarData[] = [];
  private lastSpawn: number = 0;

  constructor() {
    this.group = new THREE.Group();
  }

  public update(time: number, isMobile: boolean) {
    const spawnInterval = isMobile ? 8000 : 4000;

    if (time - this.lastSpawn > spawnInterval && Math.random() < 0.3) {
      this.spawn();
      this.lastSpawn = time;
    }

    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      star.mesh.position.add(star.speed);
      star.life += 16.7; // assuming 60fps delta

      if (star.mesh.material instanceof THREE.LineBasicMaterial) {
        const progress = star.life / star.maxLife;
        star.mesh.material.opacity = Math.max(0, 1 - progress) * 0.5;
      }

      if (star.life >= star.maxLife) {
        this.group.remove(star.mesh);
        star.mesh.geometry.dispose();
        if (Array.isArray(star.mesh.material)) {
          star.mesh.material.forEach(m => m.dispose());
        } else {
          star.mesh.material.dispose();
        }
        this.stars.splice(i, 1);
      }
    }
  }

  private spawn() {
    const geometry = new THREE.BufferGeometry();
    const length = 60 + Math.random() * 60;
    
    const startX = (Math.random() - 0.5) * 800;
    const startY = 300 + Math.random() * 100;
    const startZ = -200 - Math.random() * 200;

    const endX = startX - length;
    const endY = startY - length * 0.6;
    const endZ = startZ;

    const vertices = new Float32Array([
      startX, startY, startZ,
      endX, endY, endZ
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    const mesh = new THREE.Line(geometry, material);
    this.group.add(mesh);

    const angle = -Math.PI / 5;
    const speedVal = 10 + Math.random() * 10;

    this.stars.push({
      mesh,
      speed: new THREE.Vector3(Math.cos(angle) * speedVal, Math.sin(angle) * speedVal, 0),
      life: 0,
      maxLife: 300 + Math.random() * 300
    });
  }

  public dispose() {
    this.stars.forEach(star => {
      this.group.remove(star.mesh);
      star.mesh.geometry.dispose();
      if (Array.isArray(star.mesh.material)) {
        star.mesh.material.forEach(m => m.dispose());
      } else {
        star.mesh.material.dispose();
      }
    });
    this.stars = [];
  }
}
