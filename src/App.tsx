import React from "react"
import { Document, Page } from "react-pdf"
import { PDFPageProxy } from "pdfjs-dist/types/src/display/api"
import PropTypes from "prop-types"

import Geometry, { Point2D } from "./geometry"
import { makeBarBoxesFromActiveBarCut, BarBox } from "./barbox"

import "./App.css"

// @ts-ignore
import samplePDF from "./k522-venice.pdf"

import { pdfjs } from "react-pdf"
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

/**
 * Describes the various stages of a single bar cutting operation (the
 * finite state machine that allows us to compute a single bar cutting
 * operation).
 */
enum ActiveBarCuttingStage {
  /** **Stage 0:** The canvas is empty and no active bar cutting operation
   * can take place.
   */
  Empty = 0,

  /** **Stage 1:** The canvas is loaded, but no active bar cutting operation
   * is taking place, and one can begin at any time.
   */
  Loaded = 1,

  /** **Stage 2:** An active bar cutting operation is underway, and the top
   * left corner of the system to be extracted is being determined.
   */
  TopLeft = 2,

  /** **Stage 3:** An active bar cutting operation is underway, and the top
   * right corner of the system to be extracted is being determined.
   */
  TopRight = 4,

  /** **Stage 4:** An active bar cutting operation is underway, and the height
   * of the system to be extracted is being determined.
   */
  Height = 8,

  /** **Stage 5:** An active bar cutting operation is underway; the bounding
   * box of the system to be extracted has been entirely determined by
   * previous steps. Individual bar bar break points are being selected,
   * until the entire system has been divided.
   */
  Cutting = 16,

  /** **Stage 6:** An active bar cutting operation is just ending: Both the
   * system's overall bounding box and individual bars have been determined.
   * The metadata for the system can now be saved and new active cutting
   * operation can take place.
   */
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
  /** The image data of the PDF page currently being displayed. */
  pageData: any

  /*******************************************************
   * STATE VARIABLES OF THE ACTIVE BAR CUTTING OPERATION *
   *******************************************************/

  /** The stage at which the active bar cutting operation is at. */
  activeCutStage: ActiveBarCuttingStage

  /** Top left corner of the bounding box of the system to extract. */
  topLeftCorner: Point2D | undefined

  /** Top right corner of the bounding box of the system to extract. */
  topRightCorner: Point2D | undefined

  /** Point used to indicate the height of the system to extract. */
  staffHeightPoint: Point2D | undefined

  /** Current bar break point being selected by the user. */
  nextBarBreakPoint: Point2D | undefined

  /** List of bar break points for the active bar cutting operation. */
  barBreakPoints: Point2D[]

  /*******************************************************
   * STATE VARIABLES OF THE ACTIVE BAR CUTTING OPERATION *
   *******************************************************/

  barBoxes: BarBox[]
}

class App extends React.Component<Props, State> {
  static defaultProps = {
    lastCutThreshold: 0.98,
    saveLastCut: true,
  }

  state: State = {
    activeCutStage: ActiveBarCuttingStage.Empty,
    pageData: undefined,
    topLeftCorner: undefined,
    topRightCorner: undefined,
    staffHeightPoint: undefined,
    nextBarBreakPoint: undefined,
    barBreakPoints: [],
    barBoxes: [],
  }

  constructor(props: Props) {
    super(props)
    this.state.activeCutStage = ActiveBarCuttingStage.Empty
  }

  /**
   * Callback triggered when the PDF document is loaded.
   * @param page The PDF page that was just loaded.
   */
  onLoad = (page: PDFPageProxy) => {
    if (this.state.activeCutStage === ActiveBarCuttingStage.Empty)
      this.setState({
        activeCutStage: ActiveBarCuttingStage.Loaded,
      })

    // DEBUG init
    if (!true) {
      this.setState({
        activeCutStage: ActiveBarCuttingStage.Height,
        topLeftCorner: { x: 340, y: 128 },
        topRightCorner: { x: 1016, y: 116 },
      })
    } else {
      this.setState({
        activeCutStage: ActiveBarCuttingStage.TopLeft,
      })
    }

    // Store PDF page data so it can be used to redraw the canvas
    const canvas = document.getElementsByTagName("canvas")[0]
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
    this.setState({
      pageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    })

    // react-pdf does not allow directly to attach an onMouseMove
    // event listener, but it can be attached through the canvas
    // element.
    if (!canvas.onmousemove) {
      canvas.addEventListener(
        "mousemove",
        (e) => this.onCanvasMouseMove(e),
        false
      )
    }

    // draw the canvas for the first time
    this.redraw(ctx)
  }

  onSave = (ctx: CanvasRenderingContext2D) => {
    const redrawCallback = () => this.redraw(ctx)

    this.setState(
      {
        activeCutStage: ActiveBarCuttingStage.Empty,
      },
      redrawCallback
    )
  }

  /**
   * Callback triggered when the user clicks the canvas.
   *
   * In this callback, we determine the stage of the active bar
   * cutting, and use the user input to determine the next stage.
   *
   * @remarks This method is not involved in any display operations,
   * all of which are computed in the {@link redraw} method.
   *
   * @param event The mouse event that triggered the callback.
   * @param page The PDF page that is being currently displayed.
   */
  onCanvasClick = (
    event: React.MouseEvent<Element, MouseEvent>,
    page: PDFPageProxy
  ) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event)

    console.log(
      `x: ${x}, y: ${y}, page: ${
        page.pageNumber
      }, stage: ${this.state.activeCutStage.toString()}`
    )

    // redraw callback
    const redrawCallback = (chain?: () => void): (() => void) => {
      return () => {
        this.redraw(ctx)
        if (chain) chain()
      }
    }

    // *****************************************************************
    // FINITE STATE AUTOMATON TO COMPUTE WHAT IS THE NEXT STAGE OF THE
    // ACTIVE BAR CUTTING OPERATION

    switch (this.state.activeCutStage) {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // STAGE 1: We are selecting the top left corner of the system to
      // extract, so storing the click location (x, y) as the top left
      // corner.

      case ActiveBarCuttingStage.TopLeft:
        this.setState(
          {
            topLeftCorner: { x, y },
            activeCutStage: ActiveBarCuttingStage.TopRight,
          },
          redrawCallback()
        )
        break

      // STAGE 2: Same as Stage 1, but for the top right corner.

      case ActiveBarCuttingStage.TopRight:
        this.setState(
          {
            topRightCorner: { x, y },
            activeCutStage: ActiveBarCuttingStage.Height,
          },
          redrawCallback()
        )
        break

      // STAGE 3: Now measuring the height of the system, by setting
      // the "staffHeightPoint" based on the click location.

      case ActiveBarCuttingStage.Height:
        this.setState(
          {
            staffHeightPoint: { x, y },
            activeCutStage: ActiveBarCuttingStage.Cutting,
          },
          redrawCallback()
        )
        break

      // STAGE 4: Each click will determine a bar cut; we need also need
      // to detect when we are done with this process to move onto the
      // next stage (as unlike previous steps, there can be an arbitrary
      // number of bar cuts).

      case ActiveBarCuttingStage.Cutting:
        // check if the bar break point is beyond the bounding box of the region

        const pointProjectedTop = Geometry.projectPointOnLine(
          this.state.topLeftCorner as Point2D,
          this.state.topRightCorner as Point2D,
          { x, y },
          false
        )

        // this number computes the proportion between the starting boundary
        // of the box and the bar break point; this helps us determine whether
        // we have cut all points on the system/staff or not

        const proportionOfBox = Geometry.proportionPointOnLine(
          this.state.topLeftCorner as Point2D,
          this.state.topRightCorner as Point2D,
          pointProjectedTop as Point2D
        )

        // CONST: THRESHOLD OF SELECTION OF LAST bar break point
        if (
          this.props.lastCutThreshold &&
          proportionOfBox > this.props.lastCutThreshold
        ) {
          this.setState(
            {
              activeCutStage: ActiveBarCuttingStage.Saving,
            },
            // callback for when this state is changed
            () => {
              this.redraw(ctx)
              this.onSave(ctx)
            }
          )
        }
        if (
          this.state.activeCutStage === ActiveBarCuttingStage.Cutting ||
          this.props.saveLastCut
        ) {
          this.setState(
            {
              barBreakPoints: [...this.state.barBreakPoints, { x, y }],
            },
            redrawCallback()
          )
        }
        break

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    }
    // *****************************************************************
  }

  /**
   * Callback triggered when the user moves the mouse.
   *
   * In this callback, we do not change the stage of active bar
   * cutting operation, we only update the coordinates of the
   * point currently under consideration (top left corner, top
   * right corner, staff heigh point, bar break points), such that
   * the {@link redraw} method knows where to draw each object.
   *
   * @param event The mouse event that triggered the callback.
   */
  onCanvasMouseMove = (event: MouseEvent) => {
    const { canvas, ctx, rect, x, y } = prepCanvasEvent(event as any)

    // *****************************************************************
    // UPDATE POINTS OF ACTIVE BAR CUTTING OPERATION WITH MOUSE MOVEMENT

    switch (this.state.activeCutStage) {
      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

      // STAGE 1: Update the top left corner, of the system to extract,
      // to be whatever the mouse coordinates (x, y) are.

      case ActiveBarCuttingStage.TopLeft:
        this.setState({
          topLeftCorner: { x, y },
        })
        break

      // STAGE 2: Update the top right corner, of the system to extract,
      // to be whatever the mouse coordinates (x, y) are.

      case ActiveBarCuttingStage.TopRight:
        this.setState({
          topRightCorner: { x, y },
        })
        break

      // STAGE 3: Update the staff height measurement point to the mouse
      // coordinates (x, y).

      case ActiveBarCuttingStage.Height:
        this.setState({
          staffHeightPoint: { x, y },
        })
        break

      // STAGE 4: Update the position of the current bar break point.

      case ActiveBarCuttingStage.Cutting:
        this.setState({
          nextBarBreakPoint: { x, y },
        })
        break

      // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
    }
    // *****************************************************************

    // Redraw the canvas with the new updated points.
    this.redraw(ctx)
  }

  drawPoint = (ctx: CanvasRenderingContext2D, point: Point2D) => {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI, true)
    //ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  drawLine = (ctx: CanvasRenderingContext2D, p1: Point2D, p2: Point2D) => {
    ctx.beginPath()
    ctx.arc(p1.x, p1.y, 1, 0, 2 * Math.PI, true)
    ctx.arc(p2.x, p2.y, 1, 0, 2 * Math.PI, true)
    ctx.stroke()
  }

  /**
   * Redraws the canvas of the bar cutting component: This involves
   * visualizing the parameters of the state (top left and right corners,
   * bounding box of the system, individual bar bar break points, etc.)
   * both when they have been validated (by mouse click) but also as the
   * user makes selections.
   */
  redraw = (ctx: CanvasRenderingContext2D) => {
    // erase canvas with fresh copy of the PDF page image
    ctx.putImageData(this.state.pageData, 0, 0)

    // if no active barcutting is taking place, we end here
    if (this.state.activeCutStage === ActiveBarCuttingStage.Empty) {
      return
    }

    // picking the style for the line selection
    const applyStyleDefault = (transparent: boolean = true) => {
      ctx.lineWidth = 2
      ctx.strokeStyle = "rgba(38, 18, 225, 0.5)"
      ctx.fillStyle = "rgba(42, 107, 169, 0.9)"
      if (!transparent) {
        ctx.strokeStyle = "#2e0757ff"
        ctx.fillStyle = "#5e159fff"
      }
    }
    applyStyleDefault()

    // draw the points if they exist (and if not, this means
    // that the selection process has not processes sufficiently
    // far yet)
    if (!this.state.topLeftCorner) return
    this.drawPoint(ctx, this.state.topLeftCorner)

    if (!this.state.topRightCorner) return
    this.drawPoint(ctx, this.state.topRightCorner)

    ctx.lineWidth = 5

    // BBOX: top segment of the bounding box
    this.drawLine(ctx, this.state.topLeftCorner, this.state.topRightCorner)

    ctx.lineWidth = 2

    if (!this.state.staffHeightPoint) return

    const { p1Prime: bottomLeftCorner, p2Prime: bottomRightCorner } =
      Geometry.translateLineThroughPoint(
        this.state.topLeftCorner,
        this.state.topRightCorner,
        this.state.staffHeightPoint
      )

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
      //this.drawPoint(ctx, pointProjectedTop)
      const pointProjectedBottom = Geometry.projectPointOnLine(
        bottomLeftCorner as Point2D,
        bottomRightCorner as Point2D,
        point,
        true
      )
      if (!pointProjectedBottom) return
      //this.drawPoint(ctx, pointProjectedBottom)
      //
      return {
        top: pointProjectedTop as Point2D,
        bottom: pointProjectedBottom as Point2D,
      }
    }

    // BBOX: bottom segment of the bounding box
    this.drawLine(ctx, bottomLeftCorner, bottomRightCorner)

    // BBOX: side segments of the bounding box
    this.drawLine(ctx, bottomLeftCorner, this.state.topLeftCorner)
    this.drawLine(ctx, this.state.topRightCorner, bottomRightCorner)

    // ************************************
    // at the point the BBOX is drawn fully
    // ************************************

    // picking the style for the bar break points
    const applyStyleBarBreak = () => {
      ctx.lineWidth = 3
      ctx.textBaseline = "middle"
      ctx.font = "20pt monospace"
      ctx.strokeStyle = "#370a2cff"
      ctx.fillStyle = "#5f0b4aff"
    }

    // cut points
    var prevPoint = this.state.topLeftCorner
    var id = 0
    for (const point of this.state.barBreakPoints) {
      applyStyleBarBreak()

      //this.drawPoint(ctx, point)
      var projected = projectToLines(point)
      if (!projected) continue

      this.drawLine(ctx, projected.top, projected.bottom)

      ctx.strokeText(
        `${id}`,
        projected.top.x - (projected.top.x - prevPoint.x) / 2,
        projected.top.y + (projected.bottom.y - projected.top.y) / 2
      )

      prevPoint = point
      id += 1

      applyStyleDefault()
    }
    // bar break points
    if (!this.state.nextBarBreakPoint) return

    // NOSHOW: the mouse selection of the breaking point
    //this.drawPoint(ctx, this.state.nextBarBreakPoint)

    const lineCP = projectToLines(this.state.nextBarBreakPoint)
    if (!lineCP) return
    this.drawLine(ctx, lineCP.top, lineCP.bottom)

    // BBOX: REDRAW the bounding box
    applyStyleDefault(false)
    // BBOX: top segment of the bounding box
    this.drawLine(ctx, this.state.topLeftCorner, this.state.topRightCorner)

    // BBOX: bottom segment of the bounding box
    this.drawLine(ctx, bottomLeftCorner, bottomRightCorner)

    // BBOX: side segments of the bounding box
    this.drawLine(ctx, bottomLeftCorner, this.state.topLeftCorner)
    this.drawLine(ctx, this.state.topRightCorner, bottomRightCorner)

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
