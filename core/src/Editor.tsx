
import $ from "cash-dom"
import _ from 'lodash'
import MarkdownIt from 'markdown-it'
import * as monaco from 'monaco-editor'
import { SyntheticEvent, useEffect, useRef, useState } from 'react'
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import './manaco/userWorker'
import { InjectLineNumber, parserList } from './plugins/InjectLineNumber'

console.log(self.MonacoEnvironment)


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
  index = -1
  start = 0
  end = 0
  constructor(str: string) {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
    this.start = this.start + 1
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
let decorations = null as monaco.editor.IEditorDecorationsCollection
const blocks = new Blocks()

function highlight(from: number, to: number) {
  if (!editor) return
  if (decorations) decorations.clear()
  decorations = editor.createDecorationsCollection([{
    range: new monaco.Range(from, 1, to, 1), options: {
      isWholeLine: true,
      linesDecorationsClassName: 'Decoration-highlight'
    }
  }])
}

function highlightBlock(index: number) {
  const block = blocks.get(index)
  if (block) {
    console.log('block: ', block)
    highlight(block.start, block.end)
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

async function preload() {
  config = await (await fetch('./config.json')).json()
  console.log('json: ', config)
}


function Editor() {
  const [splitSize, setSplitSize] = useStorageInt('splitSize', 500)
  const minSize = 200
  const sample = `
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

  const [text, setText] = useState(sample)
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
      setText(editor.getModel().getValue())
    }, 200))
    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    })
    editor.onDidScrollChange(() => {

    })


    monaco.languages.registerCompletionItemProvider("markdown", {
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        var word = model.getWordUntilPosition(position)
        console.log('word: ', word, position)
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

    const render = md.renderer.render
    md.renderer.render = function (tokens, options, env) {
      //console.log('tokens: ', tokens)
      return render.call(md.renderer, tokens, options, env)
    }

    view.html(md.render(text))

    if (editor.getModel().getValue() != text) editor.getModel().setValue(text)
    blocks.clear()
    view.find('[x-src]').each((_idx, ele) => {
      $(ele).attr('x-block', blocks.length.toString())
      blocks.addBlock($(ele).attr('x-src'))
    })
    //console.log('blocks: ', blocks)
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
    editor.revealLineNearTop(lineNum, 1)
    //setDecorations(lineNum, lineNum)
    console.log('lineNum: ', lineNum)
  }

  function editorMounted(_editor: any, _monaco: any) {
    editor = _editor

    console.log('editor: ', editor, monaco)
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
          <main>
            <div className="monacoEditor" ref={monacoEditorRef}></div>
          </main>
        </div>
        <div className='SPane right' onScroll={onViewScroll}>
          <div className='mdView' ref={mdView} onClick={viewClicked}></div>
        </div>
      </SplitPane>
    </div>
  )
}

export { Editor, preload }
