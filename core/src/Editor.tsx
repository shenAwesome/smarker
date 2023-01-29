
import $ from "cash-dom"
import _ from 'lodash'
import MarkdownIt from 'markdown-it'
import * as monaco from 'monaco-editor'
import { SyntheticEvent, useEffect, useRef, useState } from 'react'
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import './manaco/userWorker'
import 'github-markdown-css'
import { InjectLineNumber, parserList } from './plugins/InjectLineNumber'
import { SLIDER_PROGRESS } from "@blueprintjs/core/lib/esm/common/classes"

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

let decorations = null as monaco.editor.IEditorDecorationsCollection

class Block {
  index = -1
  start = 0
  end = 0
  constructor(str: string) {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
    this.start = this.start + 1
  }
  highlight() {
    if (!editor) return
    if (decorations) decorations.clear()
    decorations = editor.createDecorationsCollection([{
      range: new monaco.Range(this.start, 1, this.end, 1), options: {
        isWholeLine: true,
        linesDecorationsClassName: 'Decoration-highlight'
      }
    }])
  }
}

class Blocks {
  private blocks: Block[] = []

  get(index: number) {
    return this.blocks[index]
  }

  getByLine(lineNumber: number) {
    return this.blocks.find(b => {
      return lineNumber >= b.start && lineNumber <= b.end
    })
  }

  addBlock(blockStr: string) {
    const block = new Block(blockStr)
    block.index = this.blocks.length
    this.blocks.push(block)
  }

  clear() {
    this.blocks.length = 0
  }

  get length() {
    return this.blocks.length
  }
}


let editor = null as monaco.editor.IStandaloneCodeEditor

const blocks = new Blocks()
function highlightBlock(index: number) {
  blocks.get(index)?.highlight()
}

function createSuggestions(range: monaco.IRange) {
  const kind = monaco.languages.CompletionItemKind.Function
  return config.suggestions.map(s => {
    return {
      label: s.name,
      insertText: s.syntax,
      kind, range, documentation: s.documentation
    }
  })
}

let config = null as Config

interface Suggestion {
  name: string,
  syntax: string
  documentation: string
}
interface Config {
  suggestions: Suggestion[]
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as any)
    reader.readAsDataURL(blob)
  })
}

const DataPool = {
  pool: {} as { [key: string]: string },
  cache: function (val: string) {
    const { pool } = this
    const index = Object.keys(pool).length
    const key = `--data${index}--`
    Object.assign(pool, { [key]: val })
    return key
  },
  patch: function (content: string) {
    for (const [key, value] of Object.entries(this.pool)) {
      content = content.replaceAll(key, value)
    }
    return content
  }
}

function sleep(delay: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, delay)
  })
}

async function preload() {
  config = await (await fetch('./config.json')).json()

  document.addEventListener('keydown', async evt => {
    if (evt.key == 'v' && evt.ctrlKey) {  //enable image paste
      let imageText = ''
      const clipboardItems = await navigator.clipboard.read()
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type == 'image/png') {
            const base64 = await blobToBase64(await clipboardItem.getType(type))
            imageText = `![Image](${DataPool.cache(base64)})`
          }
        }
      }
      if (imageText) {
        editor.trigger("source", "undo", null)
        navigator.clipboard.writeText(imageText)
        editor.trigger('source', 'editor.action.clipboardPasteAction', null)
        editor.revealLineInCenter(editor.getPosition().lineNumber)
      }
    }
    if (evt.key == 's' && evt.ctrlKey) {//disable browser save
      evt.preventDefault()
    }
  })
}

const MousePosition = {
  x: 0,
  y: 0
}

function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  Object.assign(MousePosition, {
    x: e.clientX,
    y: e.clientY
  })
}

function isMouseInElement(ele: HTMLElement) {
  const { left, right, top, bottom } = ele.getBoundingClientRect()
  return _.inRange(MousePosition.x, left, right) && _.inRange(MousePosition.y, top, bottom)
}

let initContent = `
# hello

# hello world 

This is the easiest method, and it allows for options to be passed into the plugin in order to select only a subset of editor features or editor languages. Read more about the Monaco Editor WebPack Plugin, which is a community authored plugin.

# best 

\`\`\`mermaid 
flowchart TD
  Start --> Stop
\`\`\`

\`\`\`dot  
Start -> Stop
\`\`\`
# hello

# hello world 

This is the easiest method, and it allows for options to be passed into the plugin in order to select only a subset of editor features or editor languages. Read more about the Monaco Editor WebPack Plugin, which is a community authored plugin.

# best 

\`\`\`mermaid 
flowchart TD
  Start --> Stop
\`\`\`

\`\`\`dot  
Start -> Stop
\`\`\`
# hello

# hello world 

This is the easiest method, and it allows for options to be passed into the plugin in order to select only a subset of editor features or editor languages. Read more about the Monaco Editor WebPack Plugin, which is a community authored plugin.

# best 

\`\`\`mermaid 
flowchart TD
  Start --> Stop
\`\`\`

\`\`\`dot  
Start -> Stop
\`\`\`

  `


function Editor() {
  const [splitSize, setSplitSize] = useStorageInt('splitSize', 500)
  const minSize = 200

  const [text, setText] = useState(initContent)
  const mdView = useRef<HTMLDivElement>(null)
  const monacoEditorRef = useRef<HTMLDivElement>(null)

  function initEditor() {
    editor = monaco.editor.create(monacoEditorRef.current, {
      fontSize: 20, wordWrap: 'on',
      glyphMargin: false, smoothScrolling: true, automaticLayout: true,
      theme: 'vs-dark', lineNumbersMinChars: 3, minimap: { enabled: false },
      language: "markdown"
    })


    editor.onDidChangeModelContent(_.debounce(() => {
      const content = editor.getModel().getValue()
      /*
      const find = /\(data:image\/png;base64,.*\)/
      const ret = find.exec(content)
      const pool = {}
      ret.forEach((val, index) => {
        const key = `(--data${index}--)`
        Object.assign(pool, { [key]: val })
        content = content.replaceAll(val, key)
      })
      */
      setText(content)
    }, 200))

    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    })

    editor.onDidScrollChange(() => {
      if (!isMouseInElement(monacoEditorRef.current)) return
      const view = mdView.current
      if (editor.getScrollTop() > 200) {
        const rect = monacoEditorRef.current.getBoundingClientRect()
        const middleLine = (rect.top + rect.bottom) / 2
        const center = Array.from(monacoEditorRef.current.querySelectorAll('.line-numbers')).map((ele) => {
          const line = parseInt(ele.innerHTML || '-1'),
            rect = ele.getBoundingClientRect(),
            distance = Math.abs((rect.top + rect.bottom) / 2 - middleLine)
          return { line, distance }
        }).sort((a, b) => a.distance - b.distance)[0]
        if (center) {
          const target = blocks.getByLine(center.line)
          if (target) {
            const targetDiv = view.querySelector(`[x-block='${target.index}']`) as HTMLElement,
              top = targetDiv.offsetTop - middleLine + (targetDiv.getBoundingClientRect().height / 2)
            view.parentElement.scrollTo({ top, behavior: 'smooth' })
          }
        }
      } else {
        view.parentElement.scrollTo(({ top: 0, behavior: 'smooth' }))
      }
    })

    editor.onDidPaste(e => {
      console.log(e)

    })

    monaco.languages.registerCompletionItemProvider("markdown", {
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        var word = model.getWordUntilPosition(position)

        if (position.column !== 1) return { suggestions: [] }

        var range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }
        return {
          suggestions: createSuggestions(range)
        }
      }
    })

    parserList.forEach(p => {
      monaco.languages.register({ id: p.language })
    })
  }

  useEffect(initEditor, [])

  useEffect(() => {
    const md = new MarkdownIt()
    md.use(InjectLineNumber)
    const view = $(mdView.current)
    view.html(DataPool.patch(md.render(text)))

    if (editor.getModel().getValue() != text) {
      const position = editor.getPosition()
      editor.getModel().setValue(text)
      editor.setPosition(position)
      editor.focus()
    }

    blocks.clear()
    view.find('[x-src]').each((_idx, ele) => {
      $(ele).attr('x-block', blocks.length.toString())
      blocks.addBlock($(ele).attr('x-src'))
    })
  }, [text])

  function onViewScroll() {
    //align the centre line, find the element closest to centre  
    if (!isMouseInElement(mdView.current.parentElement)) return
    const view = mdView.current,
      rect = view.parentElement.getBoundingClientRect(),
      centreLine = (rect.top + rect.bottom) / 2,
      centreBlock = Array.from(view.querySelectorAll('[x-src]')).find(ele => {
        const rect = (ele as HTMLElement).getBoundingClientRect()
        return _.inRange(centreLine, rect.top, rect.bottom)
      }) as HTMLElement
    if (centreBlock) {
      const lineNum = parseInt(centreBlock.getAttribute('x-src'))
      editor.revealLineInCenter(lineNum)
    }
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
    <div className="MDEditor" onMouseMove={onMouseMove}>
      <SplitPane split="vertical" minSize={minSize} maxSize={-minSize}
        defaultSize={splitSize} onChange={setSplitSize}
      >
        <div className='SPane left'>
          <main>
            <div className="monacoEditor" ref={monacoEditorRef}></div>
          </main>
        </div>
        <div className='SPane right mdView' onScroll={onViewScroll}>
          <div className='markdown-body' ref={mdView} onClick={viewClicked}></div>
        </div>
      </SplitPane>
    </div>
  )
}

export { Editor, preload }
