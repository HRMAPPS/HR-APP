import * as faceapi from 'face-api.js'

// Models are loaded once from a free public CDN (jsDelivr mirror of the
// official face-api.js weights) so there is nothing extra to host or pay
// for. If you'd rather self-host them for reliability, download the files
// from https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights/
// into /public/models and change MODEL_URL to '/models'.
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights'

let loadPromise = null

// Loads the three small models we need: face detector, landmark detector
// (used to align the face before recognition), and the recognition net that
// produces a 128-number "face descriptor". Safe to call multiple times —
// the underlying models are only fetched once.
export function loadFaceModels() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
  }
  return loadPromise
}

// Runs detection + recognition on a video/canvas/image element and returns
// a 128-length plain array (JSON-safe) describing the single face found, or
// null if no face (or more than one face) was detected.
export async function extractFaceDescriptor(mediaElement) {
  await loadFaceModels()
  const detections = await faceapi
    .detectAllFaces(mediaElement, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()

  if (!detections || detections.length !== 1) return null
  return Array.from(detections[0].descriptor)
}
