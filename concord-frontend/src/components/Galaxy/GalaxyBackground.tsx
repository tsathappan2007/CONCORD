import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { StarField } from './StarField';
import { NebulaLayer } from './NebulaLayer';
import { ShootingStars } from './ShootingStars';
import { NeuralParticles } from './NeuralParticles';

export const GalaxyBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Detect device performance profiles
    const width = window.innerWidth;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Create scene, camera, renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.0015);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 150;

    const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Group to hold scroll and mouse movements
    const universeGroup = new THREE.Group();
    scene.add(universeGroup);

    // 1. StarFields (Layer 1: tiny, Layer 2: medium)
    const starCount1 = isMobile ? 600 : isTablet ? 1500 : 3500;
    const starCount2 = isMobile ? 200 : isTablet ? 600 : 1200;
    const starField1 = new StarField(starCount1, isMobile ? 1.4 : 2.2, '#ffffff', 800);
    const starField2 = new StarField(starCount2, isMobile ? 2.0 : 3.2, '#a5f3fc', 600); // cyan/blue-white
    universeGroup.add(starField1.points);
    universeGroup.add(starField2.points);

    // 2. Nebula Layer
    let nebula: NebulaLayer | null = null;
    if (!isMobile) {
      nebula = new NebulaLayer();
      universeGroup.add(nebula.group);
    }

    // 3. Shooting Stars
    let shootingStars: ShootingStars | null = null;
    if (!isMobile && !prefersReducedMotion) {
      shootingStars = new ShootingStars();
      universeGroup.add(shootingStars.group);
    }

    // 4. Neural Network Particles
    let neuralNet: NeuralParticles | null = null;
    if (!isMobile && !prefersReducedMotion) {
      const nodeCount = isTablet ? 15 : 35;
      neuralNet = new NeuralParticles(nodeCount);
      universeGroup.add(neuralNet.points);
      universeGroup.add(neuralNet.lines);
    }

    // 5. Spiral Galaxy (Centered behind Hero)
    let galaxyPoints: THREE.Points | null = null;
    const createSpiralGalaxy = () => {
      const count = isMobile ? 800 : isTablet ? 2000 : 4000;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const opacities = new Float32Array(count);

      const radius = 220;
      const arms = 3;
      const spin = 0.8;

      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 1.5) * radius;
        const armAngle = ((i % arms) * 2 * Math.PI) / arms;
        const spinAngle = r * spin;

        // Exponential distribution for central bulge concentration
        const randomX = Math.pow(Math.random(), 3.5) * (Math.random() < 0.5 ? 1 : -1) * 16;
        const randomY = Math.pow(Math.random(), 3.5) * (Math.random() < 0.5 ? 1 : -1) * 8;
        const randomZ = Math.pow(Math.random(), 3.5) * (Math.random() < 0.5 ? 1 : -1) * 16;

        const x = Math.cos(armAngle + spinAngle) * r + randomX;
        const y = randomY;
        const z = Math.sin(armAngle + spinAngle) * r + randomZ;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Colors: white center, blue middle, violet arms
        const mixColor = new THREE.Color();
        if (r < radius * 0.25) {
          mixColor.set('#ffffff');
        } else if (r < radius * 0.65) {
          mixColor.set('#00b4d8');
        } else {
          mixColor.set('#7209b7');
        }
        colors[i * 3] = mixColor.r;
        colors[i * 3 + 1] = mixColor.g;
        colors[i * 3 + 2] = mixColor.b;

        opacities[i] = Math.random() * 0.8 + 0.2;
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: {
          uSize: { value: isMobile ? 2.5 : 4.2 },
          uScrollOpacity: { value: 1.0 }
        },
        vertexShader: `
          uniform float uSize;
          attribute float opacity;
          attribute vec3 color;
          varying float vOpacity;
          varying vec3 vColor;
          void main() {
            vOpacity = opacity;
            vColor = color;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * (350.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float uScrollOpacity;
          varying float vOpacity;
          varying vec3 vColor;
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = (1.0 - dist * 2.0) * (vOpacity * 0.5 + 0.5) * uScrollOpacity * 0.95;
            gl_FragColor = vec4(vColor, alpha);
          }
        `
      });

      galaxyPoints = new THREE.Points(geom, mat);
      // Place it offset behind hero
      galaxyPoints.position.set(50, 40, -100);
      galaxyPoints.rotation.x = Math.PI / 6;
      universeGroup.add(galaxyPoints);
    };

    createSpiralGalaxy();

    // Mouse movement listeners
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (event: MouseEvent) => {
      mouse.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.targetY = (event.clientY / window.innerHeight - 0.5) * -2;
    };
    if (!isMobile && !prefersReducedMotion) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Scroll listeners
    const scrollInfo = { current: 0, target: 0 };
    const handleScroll = () => {
      scrollInfo.target = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Resize listener
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let clock = new THREE.Clock();
    let animationFrameId: number;
    let isTabVisible = true;

    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Pause rendering when tab is hidden or reduced motion is active
      if (!isTabVisible) return;

      const elapsed = clock.getElapsedTime();

      // Smooth scroll interpolation
      scrollInfo.current += (scrollInfo.target - scrollInfo.current) * 0.05;

      // Parallax: camera shifts slightly down & rotates on scroll
      if (!prefersReducedMotion) {
        // Starfield & nebula update loops
        starField1.update(elapsed);
        starField2.update(elapsed);
        if (nebula) nebula.update();
        if (shootingStars) shootingStars.update(elapsed * 1000, isMobile);
        if (neuralNet) neuralNet.update();

        // Rotate Spiral Galaxy
        if (galaxyPoints) {
          galaxyPoints.rotation.y = elapsed * 0.02 + scrollInfo.current * 0.0003;
          
          // Fade spiral galaxy into deep space as user scrolls deeper (fades out at footer)
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollPct = docHeight > 0 ? scrollInfo.current / docHeight : 0;
          
          if (galaxyPoints.material instanceof THREE.ShaderMaterial) {
            // Galaxy fades into deep space near footer
            galaxyPoints.material.uniforms.uScrollOpacity.value = Math.max(0, 1 - scrollPct * 1.5);
          }
        }

        // Camera scroll travel effect (depth travel)
        camera.position.z = 150 - scrollInfo.current * 0.035;
        camera.position.y = -scrollInfo.current * 0.015;

        // Smooth mouse parallax easing
        mouse.x += (mouse.targetX - mouse.x) * 0.05;
        mouse.y += (mouse.targetY - mouse.y) * 0.05;
        universeGroup.rotation.y = mouse.x * 0.04;
        universeGroup.rotation.x = mouse.y * 0.02;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // Dispose geometries & materials to prevent memory leaks
      starField1.dispose();
      starField2.dispose();
      if (nebula) nebula.dispose();
      if (shootingStars) shootingStars.dispose();
      if (neuralNet) neuralNet.dispose();
      if (galaxyPoints) {
        galaxyPoints.geometry.dispose();
        if (Array.isArray(galaxyPoints.material)) {
          galaxyPoints.material.forEach(m => m.dispose());
        } else {
          galaxyPoints.material.dispose();
        }
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-[#050505] pointer-events-none -z-10 overflow-hidden"
    />
  );
};
