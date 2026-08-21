import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MATERIALS, type AcousticNode, type AcousticProjectSnapshot, type SurfaceRole, type Vec3 } from "@shared/acoustics";
import { traceRay } from "@shared/acousticMath";

type AcousticViewportProps = {
  project: AcousticProjectSnapshot;
  selectedSurface: SurfaceRole | null;
  selectedNodeId: string | null;
  onSelectSurface: (surface: SurfaceRole) => void;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: Vec3) => void;
};

const NODE_COLORS: Record<AcousticNode["kind"], number> = { source: 0xff7f11, listener: 0xf4db92 };

function materialColor(materialId: keyof typeof MATERIALS) {
  return new THREE.Color(MATERIALS[materialId].color).multiplyScalar(0.75);
}

function makeNodeIcon(kind: AcousticNode["kind"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Sprite();
  const color = kind === "source" ? "#ff7f11" : "#f4db92";
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 8;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowBlur = 11;
  context.shadowColor = color;
  if (kind === "source") {
    context.beginPath();
    context.moveTo(25, 53);
    context.lineTo(46, 53);
    context.lineTo(69, 35);
    context.lineTo(69, 93);
    context.lineTo(46, 75);
    context.lineTo(25, 75);
    context.closePath();
    context.fill();
    [17, 30].forEach((offset) => {
      context.beginPath();
      context.arc(69, 64, offset, -0.86, 0.86);
      context.stroke();
    });
  } else {
    context.beginPath();
    context.ellipse(60, 60, 25, 38, -0.18, 0.55, Math.PI * 2.15);
    context.stroke();
    context.beginPath();
    context.moveTo(63, 73);
    context.bezierCurveTo(86, 72, 85, 45, 67, 46);
    context.bezierCurveTo(48, 47, 47, 70, 61, 72);
    context.bezierCurveTo(75, 75, 72, 91, 57, 93);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set(0.08, 0.08, 1);
  sprite.position.y = 0.55;
  sprite.renderOrder = 3;
  return sprite;
}

function makeNodeMarker(node: AcousticNode) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    node.kind === "source" ? new THREE.OctahedronGeometry(0.22, 1) : new THREE.SphereGeometry(0.2, 18, 12),
    new THREE.MeshBasicMaterial({ color: NODE_COLORS[node.kind], transparent: true, opacity: 0.98 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(node.kind === "source" ? 0.34 : 0.29, 0.022, 8, 36),
    new THREE.MeshBasicMaterial({ color: NODE_COLORS[node.kind], transparent: true, opacity: 0.75 }),
  );
  ring.rotation.x = Math.PI / 2;
  const icon = makeNodeIcon(node.kind);
  group.add(core, ring, icon);
  group.userData = { type: "node", nodeId: node.id };
  group.position.set(node.position.x, node.position.y, node.position.z);
  return group;
}

function addRoomSurface(
  group: THREE.Group,
  role: SurfaceRole,
  materialId: keyof typeof MATERIALS,
  position: THREE.Vector3,
  size: [number, number, number],
  selected: boolean,
) {
  const material = new THREE.MeshBasicMaterial({
    color: materialColor(materialId),
    transparent: true,
    opacity: role === "ceiling" ? 0.14 : 0.25,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.copy(position);
  mesh.userData = { type: "surface", surfaceId: role };
  group.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: selected ? 0xffa500 : 0x6d5534, transparent: true, opacity: selected ? 1 : 0.52 }),
  );
  edges.position.copy(position);
  group.add(edges);
}

function unitDirection(index: number, count: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  return { x: Math.cos(theta) * radius, y: y * 0.52, z: Math.sin(theta) * radius };
}

export default function AcousticViewport({ project, selectedSurface, selectedNodeId, onSelectSurface, onSelectNode, onMoveNode }: AcousticViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSelectSurface, onSelectNode, onMoveNode, project });
  callbacks.current = { onSelectSurface, onSelectNode, onMoveNode, project };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const initialWidth = Math.max(1, Math.floor(mount.clientWidth));
    const initialHeight = Math.max(1, Math.floor(mount.clientHeight));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080806);
    scene.fog = new THREE.Fog(0x080806, 18, 45);
    const camera = new THREE.PerspectiveCamera(46, initialWidth / initialHeight, 0.05, 100);
    camera.position.set(12.5, 9, 14);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    controls.maxDistance = 35;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const interactive: THREE.Object3D[] = [];
    let draggedNodeId: string | null = null;

    const rebuild = () => {
      while (scene.children.length) scene.remove(scene.children[0]);
      interactive.length = 0;
      const current = callbacks.current.project;
      const { width, depth, height } = current.room;
      const surfaceMaterial = new Map(current.surfaces.map((surface) => [surface.id, surface.materialId]));
      const grid = new THREE.GridHelper(Math.max(width, depth) + 6, Math.round(Math.max(width, depth) * 4), 0x9b641e, 0x2e2619);
      grid.position.y = -0.012;
      scene.add(grid);
      const axes = new THREE.AxesHelper(1.2);
      axes.position.set(-width / 2 - 1.3, 0.02, -depth / 2 - 1.3);
      scene.add(axes);
      const roomGroup = new THREE.Group();
      const halfW = width / 2;
      const halfD = depth / 2;
      addRoomSurface(roomGroup, "floor", surfaceMaterial.get("floor") ?? "wood", new THREE.Vector3(0, -0.05, 0), [width, 0.1, depth], selectedSurface === "floor");
      addRoomSurface(roomGroup, "ceiling", surfaceMaterial.get("ceiling") ?? "concrete", new THREE.Vector3(0, height, 0), [width, 0.04, depth], selectedSurface === "ceiling");
      addRoomSurface(roomGroup, "north", surfaceMaterial.get("north") ?? "concrete", new THREE.Vector3(0, height / 2, halfD), [width, height, 0.05], selectedSurface === "north");
      addRoomSurface(roomGroup, "south", surfaceMaterial.get("south") ?? "glass", new THREE.Vector3(0, height / 2, -halfD), [width, height, 0.05], selectedSurface === "south");
      addRoomSurface(roomGroup, "east", surfaceMaterial.get("east") ?? "concrete", new THREE.Vector3(halfW, height / 2, 0), [0.05, height, depth], selectedSurface === "east");
      addRoomSurface(roomGroup, "west", surfaceMaterial.get("west") ?? "wood", new THREE.Vector3(-halfW, height / 2, 0), [0.05, height, depth], selectedSurface === "west");
      scene.add(roomGroup);
      roomGroup.children.forEach((child) => {
        if (child.userData.type === "surface") interactive.push(child);
      });

      const rayGroup = new THREE.Group();
      current.nodes.filter((node) => node.kind === "source").forEach((source, sourceIndex) => {
        const rayCount = Math.max(8, Math.floor(current.rayCount / Math.max(1, current.nodes.filter((node) => node.kind === "source").length)));
        for (let i = 0; i < rayCount; i += 1) {
          const segments = traceRay(source.position, unitDirection(i + sourceIndex * rayCount, rayCount), current);
          for (const segment of segments) {
            const opacity = Math.max(0.08, segment.energy * 0.78);
            const color = new THREE.Color().lerpColors(new THREE.Color(0x5d2610), new THREE.Color(0xffa500), segment.energy);
            const geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(segment.from.x, segment.from.y, segment.from.z),
              new THREE.Vector3(segment.to.x, segment.to.y, segment.to.z),
            ]);
            rayGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
          }
        }
      });
      scene.add(rayGroup);

      current.nodes.forEach((node) => {
        const marker = makeNodeMarker(node);
        if (node.id === selectedNodeId) marker.scale.setScalar(1.28);
        scene.add(marker);
        interactive.push(marker);
      });
    };
    rebuild();
    let resizeFrame = 0;
    let appliedWidth = initialWidth;
    let appliedHeight = initialHeight;
    const resize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        const width = Math.max(1, Math.floor(mount.clientWidth));
        const height = Math.max(1, Math.floor(mount.clientHeight));
        if (width === appliedWidth && height === appliedHeight) return;
        appliedWidth = width;
        appliedHeight = height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const pointerDown = (event: PointerEvent) => {
      setPointer(event);
      const hits = raycaster.intersectObjects(interactive, true);
      const hit = hits.find((candidate) => candidate.object.parent?.userData.type || candidate.object.userData.type);
      const target = hit?.object.parent?.userData.type ? hit.object.parent : hit?.object;
      if (!target) return;
      if (target.userData.type === "surface") callbacks.current.onSelectSurface(target.userData.surfaceId as SurfaceRole);
      if (target.userData.type === "node") {
        draggedNodeId = target.userData.nodeId as string;
        callbacks.current.onSelectNode(draggedNodeId);
        const node = callbacks.current.project.nodes.find((candidate) => candidate.id === draggedNodeId);
        dragPlane.constant = -(node?.position.y ?? 0);
        controls.enabled = false;
        renderer.domElement.setPointerCapture(event.pointerId);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (!draggedNodeId) return;
      setPointer(event);
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(dragPlane, point)) return;
      const current = callbacks.current.project;
      const node = current.nodes.find((candidate) => candidate.id === draggedNodeId);
      if (!node) return;
      const snap = current.gridSize;
      const x = Math.max(-current.room.width / 2 + 0.25, Math.min(current.room.width / 2 - 0.25, Math.round(point.x / snap) * snap));
      const z = Math.max(-current.room.depth / 2 + 0.25, Math.min(current.room.depth / 2 - 0.25, Math.round(point.z / snap) * snap));
      callbacks.current.onMoveNode(draggedNodeId, { x, y: node.position.y, z });
    };
    const pointerUp = () => {
      draggedNodeId = null;
      controls.enabled = true;
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [project, selectedSurface, selectedNodeId]);

  return <div ref={mountRef} className="h-full w-full" aria-label="Interactive three-dimensional acoustic room viewport" />;
}
