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
  stage: BarCuttingStage
  topLeftCorner: Point2D | undefined
  topRightCorner: Point2D | undefined
  staffHeightPoint: Point2D | undefined
  barBreakPoints: Point2D[]
}

class App extends React.Component<Props, State> {
  state: State = {
    stage: BarCuttingStage.Empty,
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

    switch (this.state.stage) {
      case BarCuttingStage.TopLeft:
        this.state.topLeftCorner = { x, y }
        this.state.stage = BarCuttingStage.TopRight
        break

      case BarCuttingStage.TopRight:
        this.state.topRightCorner = { x, y }
        this.state.stage = BarCuttingStage.Height
        break

      case BarCuttingStage.Height:
        this.state.staffHeightPoint = { x, y }
        this.state.stage = BarCuttingStage.Cutting
        break

      case BarCuttingStage.Cutting:
        this.state.barBreakPoints.push({ x, y })
        break
    }

    ctx.beginPath()
    ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  onLoad = (page: PDFPageProxy) => {
    this.state.page = page
    this.state.stage = BarCuttingStage.Loaded

    page.getViewport
  }

  redraw = () => {
    // load PDF
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <Document file={samplePDF} onLoadError={console.error}>
            <Page
              pageNumber={1}
              onClick={this.onCanvasClick}
              onLoadSuccess={this.onLoad}
            />
          </Document>
        </header>
      </div>
    )
  }
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
