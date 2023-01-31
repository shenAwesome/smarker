
import $ from "cash-dom"
import 'github-markdown-css'
import _, { update } from 'lodash'
import MarkdownIt from 'markdown-it'
import * as monaco from 'monaco-editor'
import React, { SyntheticEvent, useEffect, useState } from "react"
import ReactDOM from "react-dom"
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import './manaco/userWorker'
import { InjectLineNumber, parserList } from './plugins/InjectLineNumber'
import { Menu, Item, Separator, Submenu, useContextMenu, ItemParams } from 'react-contexify';
import 'react-contexify/ReactContexify.css';

const MENU_ID = 'mdEditorMenu';

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

const context = {
  editor: null as monaco.editor.IStandaloneCodeEditor,
  decorations: null as monaco.editor.IEditorDecorationsCollection,
  blocks: new Blocks(),
  config: null as Config,
  viewerDiv: null as HTMLDivElement,
  editorDiv: null as HTMLDivElement,

  update: _.debounce((selected: number) => {
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
    console.log('update')
  }, 100)
}

function createSuggestions(range: monaco.IRange) {
  const kind = monaco.languages.CompletionItemKind.Function
  return context.config.suggestions.map(s => {
    return {
      label: s.name,
      insertText: s.syntax,
      kind, range, documentation: s.documentation
    }
  })
}

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
  },
  simplify: function (content: string) {
    const { pool } = this
    const find = /\(data:image\/png;base64,.*\)/g
    let match: RegExpExecArray;
    let index = 1


    while ((match = find.exec(content)) !== null) {

      const key = `(--data${index}--)`
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

function sleep(delay: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, delay)
  })
}

async function preload() {
  context.config = await (await fetch('./config.json')).json()

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
        const { editor } = context
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
  return Editor
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

  const { show } = useContextMenu({ id: MENU_ID });

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
      setText(DataPool.patch(content))
    }, 200))

    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    })

    editor.onDidScrollChange(() => {
      if (!isMouseInElement(editorDiv)) return
      //find the top code line
      /* 
     const { top, bottom } = editorDiv.getBoundingClientRect(),
       lineNums = Array.from(editorDiv.querySelectorAll('.line-numbers')),
       lines = lineNums.filter(
         line => _.inRange(line.getBoundingClientRect().top, top, bottom) && line.innerHTML)
         .map(l => parseInt(l.innerHTML)).sort((a, b) => a - b),
       topLine = lines.find(line => blocks.getByLine(line))
     if (!topLine) return 
    
     const target = blocks.getByLine(topLine),
       offset = lineNums.find(l => parseInt(l.innerHTML) == topLine).getBoundingClientRect().top - top,
       targetDiv = viewerDiv.querySelector(`[x-block='${target.index}']`) as HTMLElement,
       moveTo = targetDiv.offsetTop - offset
     viewerDiv.parentElement.scrollTo({ top: moveTo, behavior: 'auto' }) 
     */

      /*
      const { top, bottom } = editorDiv.getBoundingClientRect(),
        lineNums = Array.from(editorDiv.querySelectorAll('.line-numbers')),
        topLine = _.min(lineNums.filter(line => _.inRange(
          line.getBoundingClientRect().top, top, bottom) && line.innerHTML)
          .map(l => parseInt(l.innerHTML)))
      */

      const scrollTop = editor.getScrollTop()
      const blockList = [new Block(), ...blocks.blocks]
      const topBlock = blockList.find(b => b.position.inEditor > scrollTop)
      if (!topBlock) return
      const b1 = blockList.filter(b => b.start < topBlock.start).pop()
      const percentage = (scrollTop - b1.position.inEditor)
        / (topBlock.position.inEditor - b1.position.inEditor)



      const newTop = b1.position.inView + ((topBlock.position.inView - b1.position.inView) * percentage)
      if (topBlock.position.inView - b1.position.inView < 0) {


      }

      viewerDiv.parentElement.scrollTop = newTop

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
          suggestions: createSuggestions(range)
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

    const simplified = DataPool.simplify(text)
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

  function onViewScroll() {
    const { viewerDiv } = context
    //align the centre line, find the element closest to centre  
    if (!isMouseInElement(viewerDiv.parentElement)) return
    const top = viewerDiv.parentElement.getBoundingClientRect().top,
      topBlock = Array.from(viewerDiv.querySelectorAll('[x-src]')).find(ele => {
        const rect = (ele as HTMLElement).getBoundingClientRect()
        return rect.top > top
      }) as HTMLElement
    if (topBlock) {
      const lineNum = parseInt(topBlock.getAttribute('x-src'))
      const editorTop = context.editor.getTopForLineNumber(lineNum + 1)
      const offset = topBlock.getBoundingClientRect().top - top
      context.editor.setScrollTop(editorTop - offset)
    }
  }

  const [selected, setSelected] = useState(-1)

  function viewClicked(event: SyntheticEvent<HTMLDivElement, MouseEvent>): void {
    const target = (event.target as HTMLElement).closest('[x-src]')
    const blockIdx = target ? parseInt(target.getAttribute('x-block')) : -1
    setSelected(blockIdx)
  }

  useEffect(() => {
    context.update(selected)
  })

  function onContextMenu(event: React.MouseEvent) {
    show({ event })
  }

  const handleItemClick = _.debounce(({ id }: ItemParams) => {

    switch (id) {
      case "edit":

        break;
      case "print":
        window.print()
        break;
    }
  }, 200)

  return <>
    <div className="MDEditor" onMouseMove={onMouseMove}  >
      <SplitPane split="vertical" minSize={minSize} maxSize={-minSize}
        size={splitSize} onChange={setSplitSize} >
        <div className='SPane left'>
          <main>
            <div className="monacoEditor" ref={createRef(context, "editorDiv")}></div>
          </main>
        </div>
        <div className='SPane right mdView' onScroll={onViewScroll} onContextMenu={onContextMenu}>
          <div className='markdown-body' ref={createRef(context, "viewerDiv")}
            onClick={viewClicked}></div>
        </div>
      </SplitPane>
    </div>

    <Menu id={MENU_ID} theme='dark' animation=''>
      <Item id="edit" onClick={handleItemClick}>Edit</Item>
      <Item id="print" onClick={handleItemClick}>Print</Item>
      <Separator />
      <Item disabled>Disabled</Item>
      <Separator />
      <Submenu label="Foobar">
        <Item id="reload" onClick={handleItemClick}>Reload</Item>
        <Item id="something" onClick={handleItemClick}>Do something else</Item>
      </Submenu>
    </Menu>
  </>
}

async function createEditor(container: HTMLElement) {
  await preload()
  ReactDOM.render(
    <React.StrictMode>  <Editor /> </React.StrictMode>,
    container
  )
}

export { createEditor }

