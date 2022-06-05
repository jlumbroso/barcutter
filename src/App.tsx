import React from "react"
import { Document, Page } from "react-pdf"
import { PDFPageProxy } from "pdfjs-dist/types/src/display/api"

import "./App.css"

// @ts-ignore
import samplePDF from "./k522-venice.pdf"

import { pdfjs } from "react-pdf"
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

type Point2D = { x: number; y: number }

const originPoint: Point2D = { x: 0, y: 0 }

enum BarCuttingStage {
  Empty = 0,
  Loaded = 1,
  TopLeft = 2,
  TopRight = 4,
  Height = 8,
  Cutting = 1,
}

const prepCanvasEvent = (event: React.MouseEvent<Element, MouseEvent>) => {
  const canvas = event.target as HTMLCanvasElement
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
  const rect = canvas.getBoundingClientRect()

  // compute coordinates relative to canvas
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  return {
    canvas,
    ctx,
    rect,
    x,
    y,
  }
}

/*const drawPoint = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.beginPath()
  ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
  ctx.stroke()
}

const drawLine = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  if (!topLeftCorner) return
  ctx.beginPath()
  console.log(topLeftCorner)
  // @ts-ignore
  ctx.arc(topLeftCorner.x, topLeftCorner.y, 1, 0, 2 * Math.PI, true)
  ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
  ctx.stroke()
}*/

type Props = {}

type State = {
  page: PDFPageProxy | undefined
  pageData: any
  stage: BarCuttingStage
  topLeftCorner: Point2D | undefined
  topRightCorner: Point2D | undefined
  staffHeightPoint: Point2D | undefined
  barBreakPoints: Point2D[]
}

class App extends React.Component<Props, State> {
  state: State = {
    stage: BarCuttingStage.Empty,
    pageData: undefined,
    page: undefined,
    topLeftCorner: undefined,
    topRightCorner: undefined,
    staffHeightPoint: undefined,
    barBreakPoints: [],
  }

  onCanvasClick = (
    event: React.MouseEvent<Element, MouseEvent>,
    page: PDFPageProxy
  ) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event)

    console.log(
      `x: ${x}, y: ${y}, page: ${page.pageNumber}, stage: ${this.state.stage}`
    )

    if (!this.state.pageData) {
      this.setState({
        pageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      })
    }

    if (!canvas.onmousemove) {
      canvas.addEventListener(
        "mousemove",
        (e) => this.onCanvasMouseMove(e),
        false
      )
    }

    switch (this.state.stage) {
      case BarCuttingStage.TopLeft:
        this.setState({
          topLeftCorner: { x, y },
          stage: BarCuttingStage.TopRight,
        })
        break

      case BarCuttingStage.TopRight:
        this.setState({
          topRightCorner: { x, y },
          stage: BarCuttingStage.Height,
        })
        break

      case BarCuttingStage.Height:
        this.setState({
          staffHeightPoint: { x, y },
          stage: BarCuttingStage.Cutting,
        })
        break

      case BarCuttingStage.Cutting:
        this.setState({
          barBreakPoints: [...this.state.barBreakPoints, { x, y }],
        })
        break
    }

    this.redraw(ctx)
  }

  onCanvasMouseMove = (event: MouseEvent) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event as any)
    //
    console.log("mouse move")
    switch (this.state.stage) {
      case BarCuttingStage.TopLeft:
        this.setState({
          topLeftCorner: { x, y },
        })
        break

      case BarCuttingStage.TopRight:
        this.setState({
          topRightCorner: { x, y },
        })
        break

      case BarCuttingStage.Height:
        this.setState({
          staffHeightPoint: { x, y },
        })
        break
    }
    this.redraw(ctx)
  }

  onLoad = (page: PDFPageProxy) => {
    this.setState({
      page: page,
    })
    if (this.state.stage === BarCuttingStage.Empty)
      this.setState({
        stage: BarCuttingStage.Loaded,
      })

    // DEBUG init
    if (!true) {
      this.setState({
        stage: BarCuttingStage.Height,
        topLeftCorner: { x: 340, y: 128 },
        topRightCorner: { x: 1016, y: 116 },
      })
    } else {
      this.setState({
        stage: BarCuttingStage.TopLeft,
      })
    }
    const canvas = document.getElementsByTagName("canvas")[0]
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    this.setState({
      pageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    })

    if (!canvas.onmousemove) {
      canvas.addEventListener(
        "mousemove",
        (e) => this.onCanvasMouseMove(e),
        false
      )
    }

    this.redraw(ctx)
  }

  drawPoint = (ctx: CanvasRenderingContext2D, point: Point2D) => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, true)
    //ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  drawLine = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    ctx.beginPath()
    // @ts-ignore
    ctx.arc(x1, y1, 1, 0, 2 * Math.PI, true)
    ctx.arc(x2, y2, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  redraw = (ctx: CanvasRenderingContext2D) => {
    // refresh PDF background
    ctx.putImageData(this.state.pageData, 0, 0)

    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(38, 18, 225, 0.5)"
    ctx.fillStyle = "rgba(42, 107, 169, 0.9)"

    // draw the points
    if (!this.state.topLeftCorner) return
    this.drawPoint(ctx, this.state.topLeftCorner)
    if (!this.state.topRightCorner) return
    this.drawPoint(ctx, this.state.topRightCorner)

    ctx.lineWidth = 5
    this.drawLine(
      ctx,
      this.state.topLeftCorner.x,
      this.state.topLeftCorner.y,
      this.state.topRightCorner.x,
      this.state.topRightCorner.y
    )
    ctx.lineWidth = 2
    if (!this.state.staffHeightPoint) return
    this.drawPoint(ctx, this.state.staffHeightPoint)

    //
    const distance = measureDistance(
      this.state.topLeftCorner,
      this.state.topRightCorner
    )
    if (distance === 0) return
    const dx =
      (this.state.topLeftCorner.x - this.state.topRightCorner.x) / distance
    const dy =
      (this.state.topLeftCorner.y - this.state.topRightCorner.y) / distance

    const height = measureHeightFromPoints(
      this.state.topLeftCorner,
      this.state.topRightCorner,
      this.state.staffHeightPoint
    )

    const vecU = { dx, dy }
    const vecV = { dx: dy, dy: -dx }

    const proportion = measureProportionOnLine(
      this.state.topLeftCorner,
      this.state.topRightCorner,
      this.state.staffHeightPoint
    )
    //console.log(proportion)

    // a point on the first line
    this.drawPoint(ctx, {
      x: this.state.staffHeightPoint.x - vecV.dx * height,
      y: this.state.staffHeightPoint.y - vecV.dy * height,
    })

    ctx.lineWidth = 4
    this.drawLine(
      ctx,
      this.state.topLeftCorner.x + vecV.dx * height,
      this.state.topLeftCorner.y + vecV.dy * height,
      this.state.topRightCorner.x + vecV.dx * height,
      this.state.topRightCorner.y + vecV.dy * height
    )

    // sides

    this.drawLine(
      ctx,
      this.state.topLeftCorner.x + vecV.dx * height,
      this.state.topLeftCorner.y + vecV.dy * height,
      this.state.topLeftCorner.x,
      this.state.topLeftCorner.y
    )
    this.drawLine(
      ctx,
      this.state.topRightCorner.x,
      this.state.topRightCorner.y,
      this.state.topRightCorner.x + vecV.dx * height,
      this.state.topRightCorner.y + vecV.dy * height
    )
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <Document file={samplePDF} onLoadError={console.error}>
            <Page
              pageNumber={1}
              onClick={this.onCanvasClick}
              onRenderSuccess={this.onLoad}
            />
          </Document>
        </header>
      </div>
    )
  }
}

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

type degree = number
type radian = number

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

export default App

/*
function App2() {
  const [operationState, setOperationState] = React.useState(
    BarCuttingSequence.Empty
  )
  const [topLeftCorner, setTopLeftCorner] = React.useState<Point2D>()
  const [topRightCorner, setTopRightCorner] = React.useState<Point2D>()
  const [staffHeightPoint, setStaffHeightPoint] = React.useState<Point2D>()
  const [barBreakPoints, setBarBreakPoints] = React.useState<Point2D[]>([])

  const measureDistance = (p1: Point2D, p2: Point2D) => {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  const drawPoint = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath()
    ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  const drawLine = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    if (!topLeftCorner) return
    ctx.beginPath()
    console.log(topLeftCorner)
    // @ts-ignore
    ctx.arc(topLeftCorner.x, topLeftCorner.y, 1, 0, 2 * Math.PI, true)
    ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  const onCanvasClick = (
    event: React.MouseEvent<Element, MouseEvent>,
    page: PDFPageProxy
  ) => {
    // pageX: The horizontal coordinate relative to the viewport.
    // clientX: The horizontal coordinate relative to the viewport, including any scroll offset.
    // screenX: The horizontal coordinate relative to the screen.

    // Get Canvas and Context element

    var canvas = event.target as HTMLCanvasElement
    var ctx = canvas.getContext("2d") as CanvasRenderingContext2D

    // Register mouse move event

    if (!canvas.onmousemove) {
      canvas.addEventListener(
        "mousemove",
        (e) => onCanvasMouseMove(e, page),
        false
      )
    }

    // Compute coordinates on the Canvas
    //
    // x ==
    //      the location of the click in the document
    //    - the location (relative to the left) of the canvas in the document
    //

    var rect = canvas.getBoundingClientRect()
    var x = event.clientX - rect.left
    var y = event.clientY - rect.top

    console.log(`PDF clicked: (x: ${x}, y: ${y})`)

    // Determine where we are in the state machine

    switch (operationState) {
      case BarCuttingSequence.TopLeft:
        // Set the top left corner
        setTopLeftCorner({ x, y })
        setOperationState(BarCuttingSequence.TopRight)
        break

      case BarCuttingSequence.TopRight:
        // Set the top right corner
        setTopRightCorner({ x, y })
        setOperationState(BarCuttingSequence.Height)
        break

      case BarCuttingSequence.Height:
        // Set the height
        setStaffHeightPoint({ x, y })
        setOperationState(BarCuttingSequence.Cutting)
        break

      case BarCuttingSequence.Cutting:
        break
    }

    return
    //var canvasWidth = canvas.width
    //var canvasHeight = canvas.height
    switch (operationState) {
      case BarCuttingSequence.Empty:
        console.log(topLeftCorner)
        setTopLeftCorner({ x, y })
        console.log(topLeftCorner)
        setOperationState(BarCuttingSequence.TopLeft)

        // @ts-ignore
        canvas.onmousemove = (event: React.MouseEvent<Element, MouseEvent>) => {
          console.log(topLeftCorner)
          console.log(event)
          console.log(rect)
          console.log(event.clientX - rect.left)
          drawLine(ctx, event.clientX - rect.left, event.clientY - rect.top)
        }
        break
      case BarCuttingSequence.TopLeft:
        drawLine(ctx, x, y)
        setTopRightCorner({ x, y })
        setOperationState(BarCuttingSequence.TopRight)
        break
      case BarCuttingSequence.TopRight:
    }
  }

  const onCanvasMouseMove = (event: MouseEvent, page: PDFPageProxy) => {
    var canvas = event.target as HTMLCanvasElement
    var ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    var rect = canvas.getBoundingClientRect()
    var x = event.clientX - rect.left
    var y = event.clientY - rect.top
    console.log(
      `Mouse move: ${topLeftCorner}, ${topRightCorner}, ${staffHeightPoint}`
    )
    return
    switch (operationState) {
      case BarCuttingSequence.TopLeft:
        break

      case BarCuttingSequence.TopRight:
        break

      case BarCuttingSequence.Height:
        // Set the height
        break

      case BarCuttingSequence.Cutting:
        break
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <Document file={samplePDF} onLoadError={console.error}>
          <Page pageNumber={1} onClick={onCanvasClick} />
        </Document>
      </header>
    </div>
  )
}

export default App*/
