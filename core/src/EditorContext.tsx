
import $ from "cash-dom"
import 'github-markdown-css'
import _ from 'lodash'
import * as monaco from 'monaco-editor'
import React from "react"
import 'react-contexify/ReactContexify.css'
import './css/Editor.scss'
import './manaco/userWorker'

class Block {
  context: EditorContext
  index = -1
  start = 0
  end = 0
  constructor(str = '-1:0') {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
    this.start = this.start + 1
  }

  highlight() {
    const { context } = this
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
  context: EditorContext
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
    block.context = this.context
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
    const { viewerDiv, blocks, editor } = this
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
    this.blocks.context = this
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
        if (this.onSave) this.onSave(this.getCode())
      }
    })
  }

  pool = new DataPool

  constructor() {
    this.update = _.debounce(this.update, 100)
  }

  onSave: (content: string) => void


  getCode() {
    const content = this.editor.getModel().getValue()
    return this.pool.patch(content)
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

function isMouseInElement(ele: HTMLElement) {
  const { left, right, top, bottom } = ele.getBoundingClientRect()
  return _.inRange(MousePosition.x, left, right) && _.inRange(MousePosition.y, top, bottom)
}

export { EditorContext, onMouseMove }

