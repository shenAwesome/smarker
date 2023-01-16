import { Alignment, Button, ButtonGroup, Navbar, NavbarDivider, NavbarGroup } from "@blueprintjs/core"
import MonacoEditor from "@monaco-editor/react"
import _ from 'lodash'
import MarkdownIt from 'markdown-it'
import { SyntheticEvent, useEffect, useRef, useState } from 'react'
import SplitPane from 'react-split-pane'
import './Editor.scss'
import { InjectLineNumber } from './plugins/InjectLineNumber'
import $ from "cash-dom"

function useStorage(key: string, defaultValue = "") {
  const value = localStorage.getItem(key) || defaultValue
  const setValue = (val: string) => {
    localStorage.setItem(key, val)
  }
  return [value, setValue] as [string, (val: string) => void]
}

function useStorageInt(key: string, defaultValue = 0): [number, (val: number) => void] {
  const [value, setValue] = useStorage(key, defaultValue.toString())
  return [parseInt(value), (val: number) => setValue(val.toString())]
}


class Block {
  start = 0
  end = 0
  constructor(str: string) {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
  }
}

let monaco = null as any
let editor = null as any
let decorations = [] as any[]
const blocks = [] as Block[]

function highlight(from: number, to: number) {
  if (!editor) return
  decorations = editor.deltaDecorations(decorations, [{
    range: new monaco.Range(from, 1, to, 1), options: {
      isWholeLine: true,
      linesDecorationsClassName: 'Decoration-highlight'
    }
  }])
}

function highlightBlock(index: number) {
  const block = blocks[index]
  if (block) {
    console.log('block: ', block)
    highlight(block.start + 1, block.end)
  }
}

//todo, to use parent , not window
function isInViewport(elem: HTMLElement) {
  var bounding = elem.getBoundingClientRect()
  return (
    bounding.top >= 0 &&
    bounding.left >= 0 &&
    bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    bounding.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

function App() {
  const [splitSize, setSplitSize] = useStorageInt('splitSize', 500)
  const minSize = 200
  const monacoOptions = {
    glyphMargin: false,
    smoothScrolling: true,
    lineNumbersMinChars: 3,
    minimap: {
      enabled: false,
    }
  }

  const [text, setText] = useState("HelloWorld")
  const mdView = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const md = new MarkdownIt()
    md.use(InjectLineNumber)
    mdView.current.innerHTML = md.render(text)
    blocks.length = 0
    $(mdView.current).find('[x-src]').each((i, ele) => {
      $(ele).attr('x-block', blocks.length.toString())
      blocks.push(new Block($(ele).attr('x-src')))
    })
    console.log('blocks: ', blocks)
  }, [text])

  const onViewScroll = () => {
    //align the centre line, find the element closest to centre
    const view = mdView.current
    const topEle = Array.from(view.querySelectorAll('[x-src]')).find(ele => {
      const rect = (ele as HTMLElement).getBoundingClientRect()
      return rect.top > 300
    }) as HTMLElement
    const lineNum = parseInt(topEle.getAttribute('x-src'))
    const top = topEle.getBoundingClientRect().top
    editor.revealLineNearTop(lineNum, lineNum, 0)
    //setDecorations(lineNum, lineNum)
    console.log('lineNum: ', lineNum)
  }

  const _setText = _.debounce(setText, 500)

  function editorMounted(_editor: any, _monaco: any) {
    editor = _editor
    monaco = _monaco
    console.log('editor: ', editor)
    editor.onMouseDown((evt: any) => {
      console.log(evt)
    })
    editor.onDidScrollChange((evt: any) => {
      console.log(evt)//todo , sync view
    })
  }

  const [selected, setSelected] = useState(-1)

  function viewClicked(event: SyntheticEvent<HTMLDivElement, MouseEvent>): void {
    const target = (event.target as HTMLElement).closest('[x-src]')
    const blockIdx = target ? parseInt(target.getAttribute('x-block')) : -1
    setSelected(blockIdx)
  }

  useEffect(() => {
    $(mdView.current).find(`[x-block]`).removeClass('selected')
    $(mdView.current).find(`[x-block='${selected}']`).addClass('selected')
    highlightBlock(selected)
  })

  return (
    <div className="MDEditor" >
      <SplitPane split="vertical" minSize={minSize} maxSize={-minSize}
        defaultSize={splitSize} onChange={setSplitSize}
      >
        <div className='SPane left'>
          <Navbar>
            <NavbarGroup align={Alignment.LEFT} className='toolbar'>
              <ButtonGroup minimal={false} >
                <Button icon="header-one" text="Header" />
                <Button icon="media" text="Image" />
                <Button icon="pie-chart" text="Chart" />
                <Button icon="code" text="Code" />
                <NavbarDivider />
                <Button icon="floppy-disk" text="" minimal={true} />
                <Button icon="cross-circle" text="" minimal={true} />
              </ButtonGroup>
            </NavbarGroup>
          </Navbar>
          <main>
            <MonacoEditor height="100%" theme="vs-dark"
              defaultLanguage="markdown" defaultValue={text}
              options={monacoOptions} onChange={_setText}
              onMount={editorMounted}
            />
          </main>
        </div>
        <div className='SPane right' onScroll={onViewScroll}>
          <div className='mdView' ref={mdView} onClick={viewClicked}></div>
        </div>
      </SplitPane>
    </div>
  )
}

export default App
