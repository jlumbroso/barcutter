import React from "react"
import { Document, Page } from "react-pdf"
import { PDFPageProxy } from "pdfjs-dist/types/src/display/api"
import PropTypes from "prop-types"

import Geometry, { Point2D } from "./geometry"

import "./App.css"

// @ts-ignore
import samplePDF from "./k522-venice.pdf"

import { pdfjs } from "react-pdf"
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

const originPoint: Point2D = { x: 0, y: 0 } as Point2D

enum BarCuttingStage {
  Empty = 0,
  Loaded = 1,
  TopLeft = 2,
  TopRight = 4,
  Height = 8,
  Cutting = 16,
  Saving = 32,
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

/**
 * Properties
 */
interface Props {
  /** Flag to determine whether the last bar cut that is made is
   * saved (or whether it is just used to exit the cutting mode).
   */
  saveLastCut?: boolean

  /** A threshold value between 0.0 and 1.0 to indicate at which
   * point a cut is considered to be out-of-bounds for an additional
   * bar.
   */
  lastCutThreshold?: number
}

interface State {
  page: PDFPageProxy | undefined
  pageData: any
  stage: BarCuttingStage
  topLeftCorner: Point2D | undefined
  topRightCorner: Point2D | undefined
  staffHeightPoint: Point2D | undefined
  cuttingPoint: Point2D | undefined
  barBreakPoints: Point2D[]
}

class App extends React.Component<Props, State> {
  static defaultProps = {
    lastCutThreshold: 0.98,
    saveLastCut: true,
  }

  state: State = {
    stage: BarCuttingStage.Empty,
    pageData: undefined,
    page: undefined,
    topLeftCorner: undefined,
    topRightCorner: undefined,
    staffHeightPoint: undefined,
    cuttingPoint: undefined,
    barBreakPoints: [],
  }

  constructor(props: Props) {
    super(props)
    this.state.stage = BarCuttingStage.Empty
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

  onCanvasClick = (
    event: React.MouseEvent<Element, MouseEvent>,
    page: PDFPageProxy
  ) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event)

    console.log(
      `x: ${x}, y: ${y}, page: ${
        page.pageNumber
      }, stage: ${this.state.stage.toString()}`
    )

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
        // check if the cutting point is beyond the bounding box of the region
        const pointProjectedTop = Geometry.projectPointOnLine(
          this.state.topLeftCorner as Point2D,
          this.state.topRightCorner as Point2D,
          { x, y },
          false
        )

        // this number computes the proportion between the starting boundary of the box and the cutting point
        // this helps us determine whether we have cut all points on the system/staff or not
        const proportionOfBox = Geometry.proportionPointOnLine(
          this.state.topLeftCorner as Point2D,
          this.state.topRightCorner as Point2D,
          pointProjectedTop as Point2D
        )

        // CONST: THRESHOLD OF SELECTION OF LAST CUTTING POINT
        if (
          this.props.lastCutThreshold &&
          proportionOfBox > this.props.lastCutThreshold
        ) {
          this.setState({
            stage: BarCuttingStage.Saving,
          })
        }
        if (
          this.state.stage === BarCuttingStage.Cutting ||
          this.props.saveLastCut
        ) {
          this.setState({
            barBreakPoints: [...this.state.barBreakPoints, { x, y }],
          })
        }
        break
    }

    this.redraw(ctx)
  }

  onCanvasMouseMove = (event: MouseEvent) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event as any)
    //
    //console.log("mouse move")
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

      case BarCuttingStage.Cutting:
        this.setState({
          cuttingPoint: { x, y },
        })
        break
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
    const distance = Geometry.measureDistance(
      this.state.topLeftCorner,
      this.state.topRightCorner
    )
    if (distance === 0) return
    const dx =
      (this.state.topLeftCorner.x - this.state.topRightCorner.x) / distance
    const dy =
      (this.state.topLeftCorner.y - this.state.topRightCorner.y) / distance

    const height = Geometry.measureHeightFromPoints(
      this.state.topLeftCorner,
      this.state.topRightCorner,
      this.state.staffHeightPoint
    )

    const vecU = { dx, dy }
    const vecV = { dx: dy, dy: -dx }

    // a point on the first line
    this.drawPoint(ctx, {
      x: this.state.staffHeightPoint.x - vecV.dx * height,
      y: this.state.staffHeightPoint.y - vecV.dy * height,
    })

    // compute points
    const bottomLeftCorner = {
      x: this.state.topLeftCorner.x + vecV.dx * height,
      y: this.state.topLeftCorner.y + vecV.dy * height,
    }
    const bottomRightCorner = {
      x: this.state.topRightCorner.x + vecV.dx * height,
      y: this.state.topRightCorner.y + vecV.dy * height,
    }

    // method to project to top and bottom
    const projectToLines = (
      point: Point2D
    ): { top: Point2D; bottom: Point2D } | undefined => {
      const pointProjectedTop = Geometry.projectPointOnLine(
        this.state.topLeftCorner as Point2D,
        this.state.topRightCorner as Point2D,
        point,
        false
      )
      if (!pointProjectedTop) return
      this.drawPoint(ctx, pointProjectedTop)
      const pointProjectedBottom = Geometry.projectPointOnLine(
        bottomLeftCorner as Point2D,
        bottomRightCorner as Point2D,
        point,
        true
      )
      if (!pointProjectedBottom) return
      this.drawPoint(ctx, pointProjectedBottom)
      //
      return {
        top: pointProjectedTop as Point2D,
        bottom: pointProjectedBottom as Point2D,
      }
    }

    ctx.lineWidth = 4
    this.drawLine(
      ctx,
      bottomLeftCorner.x,
      bottomLeftCorner.y,
      bottomRightCorner.x,
      bottomRightCorner.y
    )

    // sides
    this.drawLine(
      ctx,
      bottomLeftCorner.x,
      bottomLeftCorner.y,
      this.state.topLeftCorner.x,
      this.state.topLeftCorner.y
    )
    this.drawLine(
      ctx,
      this.state.topRightCorner.x,
      this.state.topRightCorner.y,
      bottomRightCorner.x,
      bottomRightCorner.y
    )

    // cut points
    var prevPoint = this.state.topLeftCorner
    var id = 0
    for (const point of this.state.barBreakPoints) {
      //this.drawPoint(ctx, point)
      var projected = projectToLines(point)
      if (!projected) continue

      this.drawLine(
        ctx,
        projected.top.x,
        projected.top.y,
        projected.bottom.x,
        projected.bottom.y
      )
      ctx.textBaseline = "middle"
      ctx.font = "20pt monospace"
      ctx.strokeStyle = "#370a2cff"
      ctx.strokeText(
        `${id}`,
        projected.top.x - (projected.top.x - prevPoint.x) / 2,
        projected.top.y + (projected.bottom.y - projected.top.y) / 2
      )

      prevPoint = point
      id += 1
    }
    // cutting points
    if (!this.state.cuttingPoint) return

    this.drawPoint(ctx, this.state.cuttingPoint)

    const lineCP = projectToLines(this.state.cuttingPoint)
    if (!lineCP) return
    this.drawLine(
      ctx,
      lineCP.top.x,
      lineCP.top.y,
      lineCP.bottom.x,
      lineCP.bottom.y
    )

    return
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

export default App
