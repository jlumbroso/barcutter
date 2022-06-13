import Geometry, { Point2D } from "./geometry"

export type BarBox = {
  // POSITIONAL PROPERTIES
  upperLeftCorner: Point2D
  height: number
  width: number

  // four corners
  corners: Point2D[]

  // SEMANTIC PROPERTIES
  indexInRow: number
  indexInPage: number
  indexInDocument: number
}

/** Top left corner of the bounding box of the system to extract. */
/** Top right corner of the bounding box of the system to extract. */
/** Point used to indicate the height of the system to extract. */
/** List of bar break points for the active bar cutting operation. */

export function makeBarBoxesFromActiveBarCut(
  topLeftCorner: Point2D | undefined,
  topRightCorner: Point2D | undefined,
  staffHeightPoint: Point2D | undefined,
  barBreakPoints: Point2D[],
  firstBarIndexInPage: number,
  firstBarIndexInDocument: number
): BarBox[] {
  const barBoxes: BarBox[] = []

  // validate input
  if (
    topLeftCorner === undefined ||
    topRightCorner === undefined ||
    staffHeightPoint === undefined
  ) {
    return []
  }

  // (re)compute the bottom left and right corner of the bounding box
  const {
    p1Prime: bottomLeftCorner,
    p2Prime: bottomRightCorner,
    height,
  } = Geometry.translateLineThroughPoint(
    topLeftCorner,
    topRightCorner,
    staffHeightPoint
  )

  // iterate through the barBreakPoints
  let barUpLeft = topLeftCorner
  let barDownLeft = bottomLeftCorner

  for (let i = 0; i < barBreakPoints.length; i++) {
    const barBreakPoint = barBreakPoints[i]

    // compute projections of the break point on the top and bottom lines
    const barUpRight = Geometry.projectPointOnLine(
      topLeftCorner,
      topRightCorner,
      barBreakPoint
    )
    const barDownRight = Geometry.projectPointOnLine(
      bottomLeftCorner,
      bottomRightCorner,
      barBreakPoint
    )

    if (!barUpRight || !barDownRight) continue

    const barBox = {
      // POSITIONAL PROPERTIES
      upperLeftCorner: barUpLeft,
      height: height,
      width: Geometry.measureDistance(barUpLeft, barUpRight),

      // four corners
      corners: [barUpLeft, barUpRight, barDownRight, barDownLeft],

      // SEMANTIC PROPERTIES
      indexInRow: i,
      indexInPage: firstBarIndexInPage + i,
      indexInDocument: firstBarIndexInDocument + i,
    }

    barBoxes.push(barBox)

    // update the upper left and lower right corners of the bounding box
    barUpLeft = barUpRight
    barDownLeft = barDownRight
  }

  return barBoxes
}
