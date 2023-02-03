
import $ from "cash-dom"
import 'github-markdown-css'
import _ from 'lodash'
import MarkdownIt from 'markdown-it'
import * as monaco from 'monaco-editor'
import React, { SyntheticEvent, useEffect, useState } from "react"
import { Item, ItemParams, Menu, Separator, Submenu, useContextMenu } from 'react-contexify'
import 'react-contexify/ReactContexify.css'
import ReactDOM from "react-dom"
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import './manaco/userWorker'
import { InjectLineNumber, parserList } from './plugins/InjectLineNumber'
import classNames from "classnames"

import { FaArrowDown, FaArrowUp, FaEdit, FaPrint } from 'react-icons/fa'
import { BiArrowToTop, BiArrowToBottom } from 'react-icons/bi'

const MENU_ID = 'mdEditorMenu'

function useRefresh() {
  const [_, setNum] = useState(0)
  return () => setNum(Date.now)
}

function useStorage(key: string, defaultValue = "") {
  const refresh = useRefresh()
  const value = localStorage.getItem(key) || defaultValue
  const setValue = (val: string) => {
    localStorage.setItem(key, val)
    refresh()
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
  constructor(str = '-1:0') {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
    this.start = this.start + 1
  }
  highlight() {
    if (!context.editor) return
    if (context.decorations) context.decorations.clear()
    context.decorations = context.editor.createDecorationsCollection([{
      range: new monaco.Range(this.start, 1, this.end, 1), options: {
        isWholeLine: true,
        linesDecorationsClassName: 'Decoration-highlight'
      }
    }])
  }

  position = {
    inView: 0,
    inEditor: 0
  }
}

class Blocks {
  public blocks: Block[] = []

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

  highlight(index: number) {
    this.get(index)?.highlight()
  }
}


class DataPool {
  pool = {} as { [key: string]: string }
  cache(val: string) {
    const { pool } = this,
      index = Object.keys(pool).length + 1,
      key = `--data:image/${index}--`
    Object.assign(pool, { [key]: val })
    return key
  }
  patch(content: string) {
    for (const [key, value] of Object.entries(this.pool)) {
      content = content.replaceAll(key, value)
    }
    return content
  }
  simplify(content: string) {
    const { pool } = this
    const find = /\(data:image\/png;base64,.*\)/g
    let match: RegExpExecArray
    let index = 1

    while ((match = find.exec(content)) !== null) {
      const key = `(--data:image/${index}--)`
      const val = match[0]
      Object.assign(pool, { [key]: val })
      index++
    }

    for (const [key, value] of Object.entries(this.pool)) {
      content = content.replaceAll(value, key)
    }
    return content
  }
}

class EditorContext {
  editor: monaco.editor.IStandaloneCodeEditor
  decorations: monaco.editor.IEditorDecorationsCollection
  blocks = new Blocks()
  config: Config
  viewerDiv: HTMLDivElement
  editorDiv: HTMLDivElement

  update(selected: number) {
    const { viewerDiv, blocks, editor } = context
    $(viewerDiv).find(`[x-block]`).removeClass('selected')
    $(viewerDiv).find(`[x-block='${selected}']`).addClass('selected')
    blocks.highlight(selected)
    //update block position for scrolling
    const viewTop = viewerDiv.getBoundingClientRect().top
    blocks.blocks.forEach(b => {
      b.position.inEditor = editor.getTopForLineNumber(b.start)
      b.position.inView = viewerDiv.querySelector(`[x-block='${b.index}']`)
        .getBoundingClientRect().top - viewTop
    })
  }

  createSuggestions(range: monaco.IRange) {
    const kind = monaco.languages.CompletionItemKind.Function
    return this.config.suggestions.map(s => {
      return {
        label: s.name,
        insertText: s.syntax,
        kind, range, documentation: s.documentation
      }
    })
  }


  async preload() {
    this.config = await (await fetch('./config.json')).json()
    document.addEventListener('keydown', async evt => {
      if (evt.key == 'v' && evt.ctrlKey) {  //enable image paste
        let imageText = ''
        const clipboardItems = await navigator.clipboard.read()
        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            if (type == 'image/png') {
              const base64 = await blobToBase64(await clipboardItem.getType(type))
              imageText = `![Image](${this.pool.cache(base64)})`
            }
          }
        }
        if (imageText) {
          const { editor } = this
          editor.trigger("source", "undo", null)
          navigator.clipboard.writeText(imageText)
          editor.trigger('source', 'editor.action.clipboardPasteAction', null)
          editor.revealLineNearTop(editor.getPosition().lineNumber)
        }
      }
      if (evt.key == 's' && evt.ctrlKey) {//disable browser save
        evt.preventDefault()
      }
    })
  }

  pool = new DataPool

  constructor() {
    this.update = _.debounce(this.update, 100)

  }

  onEditorScroll() {
    const { viewerDiv, editorDiv, editor, blocks } = this
    if (!isMouseInElement(editorDiv)) return
    const scrollTop = editor.getScrollTop(),
      blockList = [new Block(), ...blocks.blocks],
      topBlock = blockList.find(b => b.position.inEditor > scrollTop)
    if (!topBlock) return
    const prev = blockList[blockList.indexOf(topBlock) - 1],
      percentage = (scrollTop - prev.position.inEditor)
        / (topBlock.position.inEditor - prev.position.inEditor),
      newTop = prev.position.inView + ((topBlock.position.inView - prev.position.inView) * percentage)
    viewerDiv.parentElement.scrollTop = newTop
  }

  onViewerScroll() {
    const { viewerDiv, editor, blocks } = this
    if (!isMouseInElement(viewerDiv.parentElement)) return
    const scrollTop = viewerDiv.parentElement.scrollTop,
      blockList = [new Block(), ...blocks.blocks],
      topBlock = blockList.find(b => b.position.inView > scrollTop)
    if (!topBlock) return
    const prev = blockList[blockList.indexOf(topBlock) - 1],
      percentage = (scrollTop - prev.position.inView)
        / (topBlock.position.inView - prev.position.inView),
      newTop = prev.position.inEditor + ((topBlock.position.inEditor - prev.position.inEditor) * percentage)
    editor.setScrollTop(newTop)
  }

}

const context = new EditorContext


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

function sleep(delay: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, delay)
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

function createRef<T>(obj: T, key: keyof T) {
  return {
    set current(value: any) {
      obj[key] = value
    }
  }
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
  const [text, setText] = useStorage('mdContext', initContent)
  const { blocks } = context
  const minSize = 200

  const { show } = useContextMenu({ id: MENU_ID })

  useEffect(() => {
    const { editorDiv, viewerDiv } = context
    const editor = monaco.editor.create(editorDiv, {
      fontSize: 20, wordWrap: 'on',
      glyphMargin: false, smoothScrolling: false, automaticLayout: true,
      theme: 'vs-dark', lineNumbersMinChars: 3, minimap: { enabled: false },
      language: "markdown"
    })

    Object.assign(context, { editor })
    editor.onDidChangeModelContent(_.debounce(() => {
      const content = editor.getModel().getValue()
      setText(context.pool.patch(content))
    }, 200))

    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    })

    editor.onDidScrollChange(() => {
      context.onEditorScroll()
    })

    monaco.languages.registerCompletionItemProvider("markdown", {
      provideCompletionItems: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        const word = model.getWordUntilPosition(position)
        if (position.column !== 1) return { suggestions: [] }
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }
        return {
          suggestions: context.createSuggestions(range)
        }
      }
    })

    parserList.forEach(p => {
      monaco.languages.register({ id: p.language })
    })
  }, [])

  useEffect(() => {
    const { viewerDiv, editor } = context
    const md = new MarkdownIt()
    md.use(InjectLineNumber)
    const view = $(viewerDiv)
    view.html(md.render(text))

    const simplified = context.pool.simplify(text)
    if (editor.getModel().getValue() != simplified) {
      const position = editor.getPosition()
      editor.getModel().setValue(simplified)
      editor.setPosition(position)
      editor.focus()
    }

    blocks.clear()
    view.find('[x-src]').each((_idx, ele) => {
      $(ele).attr('x-block', blocks.length.toString())
      blocks.addBlock($(ele).attr('x-src'))
    })
  }, [text])


  const [selected, setSelected] = useState(-1)
  const [_showEditor, setShowEditor] = useStorage('setShowEditor', 'true')
  const showEditor = _showEditor == 'true'

  function viewClicked(event: SyntheticEvent<HTMLDivElement, MouseEvent>): void {
    const target = (event.target as HTMLElement).closest('[x-src]')
    const blockIdx = target ? parseInt(target.getAttribute('x-block')) : -1
    setSelected(blockIdx)
  }

  useEffect(() => {
    context.update(showEditor ? selected : -1)
  })

  function onContextMenu(event: React.MouseEvent) {
    show({ event })
  }

  const handleItemClick = _.debounce(({ id }: ItemParams) => {
    const viewerContainer = context.viewerDiv.parentElement

    switch (id) {
      case "edit":
        setShowEditor((!showEditor) + "")
        break
      case "print":
        window.print()
        break
      case "toTop":
        viewerContainer.scrollTop = 0
        break
      case "toBottom":
        viewerContainer.scrollTop = viewerContainer.scrollHeight
        break
    }
  }, 200)
  //className="MDEditor"

  return <>
    <div className={classNames("MDEditor", { hideEditor: !showEditor })} onMouseMove={onMouseMove}  >
      <SplitPane split="vertical" minSize={minSize} maxSize={-minSize}
        size={splitSize} onChange={setSplitSize} >
        <div className='SPane left'>
          <main>
            <div className="monacoEditor" ref={createRef(context, "editorDiv")}></div>
          </main>
        </div>
        <div className='SPane right mdView' onScroll={() => context.onViewerScroll()} onContextMenu={onContextMenu}>
          <div className='markdown-body' ref={createRef(context, "viewerDiv")}
            onClick={viewClicked}></div>
        </div>
      </SplitPane>
    </div>

    <Menu id={MENU_ID} theme='dark' animation=''>
      <Item id="edit" onClick={handleItemClick}> <FaEdit /> Edit</Item>
      <Item id="print" onClick={handleItemClick}><FaPrint />Print</Item>
      <Item id="toTop" onClick={handleItemClick}><FaArrowUp />to Top</Item>
      <Item id="toBottom" onClick={handleItemClick}><FaArrowDown />to Bottom</Item>
    </Menu>
  </>
}

async function createEditor(container: HTMLElement) {
  await context.preload()
  ReactDOM.render(
    <React.StrictMode>  <Editor /> </React.StrictMode>,
    container
  )
}

export { createEditor }

