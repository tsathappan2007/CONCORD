import * as THREE from 'three';

export class NebulaLayer {
  public group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();

    const count = 4;
    const colors = ['#080e21', '#0b001a', '#020514', '#07101a'];
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);

    for (let i = 0; i < count; i++) {
      const size = 700 + Math.random() * 500;
      const geom = new THREE.PlaneGeometry(size, size);
      
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colors[i % colors.length]),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: texture
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 300,
        -500 - Math.random() * 200
      );
      mesh.rotation.z = Math.random() * Math.PI * 2;
      this.group.add(mesh);
    }
  }

  public update() {
    this.group.children.forEach((mesh, index) => {
      mesh.rotation.z += 0.00015 * (index % 2 === 0 ? 1 : -1);
    });
  }

  public dispose() {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
