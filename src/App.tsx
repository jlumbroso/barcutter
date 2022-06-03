import React from "react"
import { Document, Page } from "react-pdf/dist/esm/entry.webpack5"
import { PDFPageProxy } from "pdfjs-dist/types/src/display/api"

import "./App.css"

// @ts-ignore
import samplePDF from "./k522-venice.pdf"

enum BarCuttingSequence {
  Empty = 0,
  TopLeft = 1,
  TopRight = 2,
  Height = 4,
  Cutting = 8,
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

  // Compute coordinates on the Canvas
  // x == the location of the click in the document - the location (relative to the left) of the canvas in the document
  var rect = canvas.getBoundingClientRect()
  var x = event.clientX - rect.left
  var y = event.clientY - rect.top

  //console.log(event)
  //console.log(page)
  console.log(`x: ${x}, y: ${y}`)

  //var canvasWidth = canvas.width
  //var canvasHeight = canvas.height

  ctx.beginPath()
  ctx.arc(x, y, 1, 0, 2 * Math.PI, true)
  ctx.stroke()
}

function App() {
  const [operationState, setOperationState] = React.useState(
    BarCuttingSequence.Empty
  )
  //const [pageNumber, setPageNumber] = useState(1);

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

export default App
