/**
 * Data structure for a 2D point.
 * @param x The x coordinate.
 * @param y The y coordinate.
 */
export type Point2D = {
  /** The x coordinate. */
  x: number
  /** The y coordinate. */
  y: number
}

/**
 * Data type for an angle stored in degrees.
 */
export type degree = number

/**
 * Data type for an angle stored in radians.
 */
export type radian = number

/**
 * Given three points on a line — {@link p1}, {@link p2} and
 * {@link pProject} — returns the ratio of the distance between
 * {@link p1} and {@link p2} to the distance of {@link p1} to
 * {@link pProject}.
 *
 * @remarks
 * In particular, if the ratio computed by this function is
 * close to 0.0, then it means {@link pProject} is close to
 * {@link p1}; if this ratio is close to 1.0, then it means
 * {@link pProject} is very close to {@link p2}.
 *
 * @param p1 The leftmost point (with smallest {x}-coordinate).
 * @param p2 The right point (with largest {x}-coordinate).
 * @param pProject The point (on the line from {@link p1}
 * to {@link p2}) to compute the ratio for.
 * @param flip I don't remember what this does (FIXME!).
 *
 * @returns The ratio of the distance between {@link p1}
 * and {@link pProject}, and {@link p2} and {@link pProject}.
 */
const proportionPointOnLine = (
  p1: Point2D,
  p2: Point2D,
  pProject: Point2D,
  flip: boolean = false
) => {
  // assume all points are on line (otherwise unexpected results!)
  // p1 and p2 are the end points of the line
  // pProject is the point to project

  // check?
  const pProjectPrime = projectPointOnLine(p1, p2, pProject, flip)
  console.log(
    pProjectPrime &&
      pProject.x === pProjectPrime.x &&
      pProject.y === pProjectPrime.y
  )

  if (p1.x !== p2.x) return (pProject.x - p1.x) / (p2.x - p1.x)
  else return (pProject.y - p1.y) / (p2.y - p1.y)
}

const projectPointOnLine = (
  p1: Point2D,
  p2: Point2D,
  pProject: Point2D,
  flip: boolean = false
) => {
  // p1 x---X-----x p2
  //        |
  //        x pProject
  //

  const distance = measureDistance(p1, p2)
  if (distance === 0) return

  const dx = (p1.x - p2.x) / distance
  const dy = (p1.y - p2.y) / distance

  const vecLineP1toP2 = { dx, dy }
  const vecOrthogonalToLineP1toP2 = {
    dx: dy * (flip ? -1 : 1),
    dy: -dx * (flip ? -1 : 1),
  }

  const height = measureHeightFromPoints(p1, p2, pProject)

  return {
    x: pProject.x - vecOrthogonalToLineP1toP2.dx * height,
    y: pProject.y - vecOrthogonalToLineP1toP2.dy * height,
  }
}

// SUSPICIOUS CODE
const measureProportionOnLine = (
  p1: Point2D,
  p2: Point2D,
  pMiddle: Point2D
) => {
  //
  const height = measureHeightFromPoints(p1, p2, pMiddle)
  const angle = measureAngleFromPoints(p2, pMiddle, p1)

  // we are trying to compute the adjacent side of the triangle
  // given: (a) hypothenuse (height) and (b) angle

  const segment = height / Math.sin(angle)

  const distance = measureDistance(p1, p2)
  const proportion = segment / distance
  console.log(
    `segment: ${segment} distance: ${distance} proportion: ${proportion}`
  )
  return proportion
}

const measureLineDiff = (p1: Point2D, p2: Point2D) => {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const length = Math.sqrt(dx * dx + dy * dy)
  return {
    dx: dx / length,
    dy: dy / length,
    length: length,
  }
}

const measureDistance = (p1: Point2D, p2: Point2D) => {
  return measureLineDiff(p1, p2).length
}

const measureHeightFromPoints = (
  p1: Point2D,
  p2: Point2D,
  pMiddle: Point2D
) => {
  const area = measureTriangleAreaFromPoints(p1, p2, pMiddle)
  const base = measureDistance(p1, p2)
  return (2 * area) / base
}

/**
 * Given two points forming a segment, {@link p1} and {@link p2},
 * and some point {@link pPrime} not on the line formed by the
 * two points, returns a new segment, parallel to the original one,
 * and on the line that goes through {@link pPrime}.
 *
 * @param p1 The leftmost point (with smallest {x}-coordinate).
 * @param p2 The right point (with largest {x}-coordinate).
 * @param pPrime A point that belons to the line on which the
 *              new segment will be placed.
 *
 * @returns The endpoints of the new segment that is parallel to
 * the segment formed by {@link p1} and {@link p2}.
 */
const translateLineThroughPoint = (
  p1: Point2D,
  p2: Point2D,
  pPrime: Point2D
) => {
  // p1 x-------X-----x p2
  //             \
  //     (*)------x----(*)
  // p1Prime    pPrime   p2Prime

  // compute line vector of line (p1, p2), then the distance from the
  // line (p1, p2) to the point pPrime
  const vecLine = Geometry.measureLineDiff(p1, p2)
  const vecOrthoLine = {
    dx: -vecLine.dy,
    dy: vecLine.dx,
  }
  const translationDistance = Geometry.measureHeightFromPoints(p1, p2, pPrime)

  // compute points
  const p1Prime = {
    x: p1.x + vecOrthoLine.dx * translationDistance,
    y: p1.y + vecOrthoLine.dy * translationDistance,
  }
  const p2Prime = {
    x: p2.x + vecOrthoLine.dx * translationDistance,
    y: p2.y + vecOrthoLine.dy * translationDistance,
  }

  return {
    p1Prime,
    p2Prime,
  }
}

const measureTriangleAreaFromPoints = (
  p1: Point2D,
  p2: Point2D,
  p3: Point2D
) => {
  const a = measureDistance(p1, p2)
  const b = measureDistance(p2, p3)
  const c = measureDistance(p3, p1)
  const s = (a + b + c) / 2
  return Math.sqrt(s * (s - a) * (s - b) * (s - c))
}

// Converts radians to degrees.
function radianToDegrees(angle: radian): degree {
  return angle * (180 / Math.PI)
}

// Converts degrees to radians.
function degreesToRadian(angle: degree): radian {
  return angle * (Math.PI / 180)
}

function getLineAngle(p1: Point2D, p2: Point2D): radian {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const angle = Math.atan2(dy, dx)
  return angle
}

function measureAngleFromPoints(
  p1: Point2D,
  p2: Point2D,
  pMiddle: Point2D
): radian {
  var AB = Math.sqrt(
    Math.pow(pMiddle.x - p1.x, 2) + Math.pow(pMiddle.y - p1.y, 2)
  )
  var BC = Math.sqrt(
    Math.pow(pMiddle.x - p2.x, 2) + Math.pow(pMiddle.y - p2.y, 2)
  )
  var AC = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  return Math.acos((BC * BC + AB * AB - AC * AC) / (2 * BC * AB))
}
const measureAngleFromPoints2 = (
  p1: Point2D,
  p2: Point2D,
  pMiddle: Point2D
) => {
  // Measure angle in this configuration:
  //   p1
  //  /
  // pMiddle -- p2

  const numerator =
    p1.y * (pMiddle.x - p2.x) +
    pMiddle.y * (p2.x - p1.x) +
    p2.y * (p1.x - pMiddle.x)
  const denominator =
    (p1.x - pMiddle.x) * (pMiddle.x - p2.x) +
    (p1.y - pMiddle.y) * (pMiddle.y - p2.y)
  const ratio = numerator / denominator

  const angleRad = Math.atan(ratio)
  //return angleRad

  const angleDeg = (angleRad * 180) / Math.PI

  if (angleDeg < 0) {
    return angleDeg + 180
  }

  return angleDeg
}

const Geometry = {
  proportionPointOnLine,
  projectPointOnLine,
  measureLineDiff,
  measureDistance,
  measureHeightFromPoints,
  measureTriangleAreaFromPoints,
  translateLineThroughPoint,
  radianToDegrees,
  degreesToRadian,
  getLineAngle,
  measureAngleFromPoints,
  measureAngleFromPoints2,
}

export default Geometry
