import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Box3, BufferAttribute, Group, Mesh, Vector3 } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

class NodeFileReader {
  constructor() {
    this.result = null
    this.onloadend = null
    this.onerror = null
  }

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer()
      this.onloadend?.({ target: this })
    } catch (error) {
      this.onerror?.(error)
    }
  }

  async readAsDataURL(blob) {
    try {
      const bytes = Buffer.from(await blob.arrayBuffer())
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${bytes.toString('base64')}`
      this.onloadend?.({ target: this })
    } catch (error) {
      this.onerror?.(error)
    }
  }
}

globalThis.FileReader ??= NodeFileReader
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, properties = {}) {
    this.type = type
    Object.assign(this, properties)
  }
}

const [, , inputArgument, outputArgument] = process.argv
if (!inputArgument || !outputArgument) {
  throw new Error('Usage: node scripts/bake-static-gltf.mjs <input.gltf> <output.glb>')
}

const inputPath = path.resolve(inputArgument)
const outputPath = path.resolve(outputArgument)
const sourceJson = JSON.parse(await fs.readFile(inputPath, 'utf8'))

for (const buffer of sourceJson.buffers ?? []) {
  if (!buffer.uri || buffer.uri.startsWith('data:')) continue
  const bufferPath = path.resolve(path.dirname(inputPath), decodeURIComponent(buffer.uri))
  const bytes = await fs.readFile(bufferPath)
  buffer.uri = `data:application/octet-stream;base64,${bytes.toString('base64')}`
}

const source = await new GLTFLoader().parseAsync(JSON.stringify(sourceJson), `${path.dirname(inputPath)}/`)
source.scene.updateMatrixWorld(true)

const staticRoot = new Group()
staticRoot.name = `${source.scene.name || 'model'}_static`
const vertex = new Vector3()
let sourceMeshCount = 0
let bakedSkinCount = 0
const meshDiagnostics = []

source.scene.traverse((object) => {
  if (!object.isMesh) return

  sourceMeshCount += 1
  const geometry = object.geometry.clone()
  const positions = geometry.getAttribute('position')

  if (object.isSkinnedMesh && positions) {
    const bakedPositions = new Float32Array(positions.count * 3)
    for (let index = 0; index < positions.count; index += 1) {
      object.getVertexPosition(index, vertex)
      bakedPositions[index * 3] = vertex.x
      bakedPositions[index * 3 + 1] = vertex.y
      bakedPositions[index * 3 + 2] = vertex.z
    }
    geometry.setAttribute('position', new BufferAttribute(bakedPositions, 3))
    geometry.deleteAttribute('skinIndex')
    geometry.deleteAttribute('skinWeight')
    geometry.computeVertexNormals()
    bakedSkinCount += 1
  }

  geometry.applyMatrix4(object.matrixWorld)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  meshDiagnostics.push({
    name: object.name,
    skinned: Boolean(object.isSkinnedMesh),
    center: geometry.boundingBox.getCenter(new Vector3()).toArray().map((value) => Number(value.toFixed(6))),
    size: geometry.boundingBox.getSize(new Vector3()).toArray().map((value) => Number(value.toFixed(6))),
  })

  const material = Array.isArray(object.material)
    ? object.material.map((entry) => entry.clone())
    : object.material.clone()
  const mesh = new Mesh(geometry, material)
  mesh.name = `${object.name || `mesh_${sourceMeshCount}`}_static`
  mesh.castShadow = false
  mesh.receiveShadow = false
  staticRoot.add(mesh)
})

staticRoot.updateMatrixWorld(true)
const exported = await new GLTFExporter().parseAsync(staticRoot, {
  binary: true,
  onlyVisible: true,
  trs: false,
})

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, Buffer.from(exported))

const verification = await new GLTFLoader().parseAsync(exported, '')
verification.scene.updateMatrixWorld(true)
let verifiedMeshCount = 0
let verifiedSkinnedMeshCount = 0
verification.scene.traverse((object) => {
  if (object.isMesh) verifiedMeshCount += 1
  if (object.isSkinnedMesh) verifiedSkinnedMeshCount += 1
})
const verifiedSize = new Box3()
  .setFromObject(verification.scene)
  .getSize(new Vector3())
  .toArray()
  .map((value) => Number(value.toFixed(6)))

console.log(JSON.stringify({
  input: inputPath,
  output: outputPath,
  sourceMeshCount,
  bakedSkinCount,
  verifiedMeshCount,
  verifiedSkinnedMeshCount,
  verifiedSize,
  meshDiagnostics,
  outputBytes: Buffer.byteLength(exported),
}, null, 2))
