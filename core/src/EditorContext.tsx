
import $ from "cash-dom"
import 'github-markdown-css'
import _ from 'lodash'
import MarkdownIt from 'markdown-it'
import markdownContainer from 'markdown-it-container'
import markdownTaskLists from 'markdown-it-task-lists'

import * as monaco from 'monaco-editor'
import 'react-contexify/ReactContexify.css'
import './css/Editor.scss'
import './manaco/userWorker'
import { addParser, Handle, InjectLineNumber, parserList } from "./plugins/InjectLineNumber"


import * as _actions from "monaco-editor/esm/vs/platform/actions/common/actions"
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices"
import { createDecorator } from 'monaco-editor/esm//vs/platform/instantiation/common/instantiation'

//console.log('actions: ', actions)

function deleteAction(ids: string[]) {
  const menus = _actions.MenuRegistry._menuItems as Map<any, any>
  const contextMenuEntry = Array.from(menus, ([key, value]) => ({ key, value }))
    .find(entry => entry.key.id == 'EditorContext')
  const list = contextMenuEntry.value
  const removeById = (list: any, ids: string[]) => {
    let node = list._first
    do {
      let shouldRemove = ids.includes(node.element?.command?.id)
      if (shouldRemove) list._remove(node)
    } while ((node = node.next))
  }
  removeById(list, ids)
  //console.log(list)
}


class Block {
  index = -1
  start = 0
  end = 0
  position = {
    inView: 0,
    inEditor: 0
  }

  constructor(str = '-1:0') {
    [this.start, this.end] = str.split(":").map(s => parseInt(s))
    this.start = this.start + 1
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
    const block = this.get(index)
    if (block) {
      const { context } = this
      if (!context.editor) return
      if (context.decorations) context.decorations.clear()
      context.decorations = context.editor.createDecorationsCollection([{
        range: new monaco.Range(block.start, 1, block.end, 1), options: {
          isWholeLine: true,
          linesDecorationsClassName: 'Decoration-highlight'
        }
      }])
    }
  }
}

class DataPool {
  pool = {} as { [key: string]: string }

  cache(val: string) {
    //console.log(Object.keys(this.pool))
    const { pool } = this
    let key = Object.keys(pool).find(k => pool[k] == val)
    if (!key) {
      const genKey = (index: number) => `--data:image/${index}--`
      let index = 1
      while (Object.keys(pool).includes(genKey(index))) {
        index++
      }
      key = genKey(index)
      Object.assign(pool, { [key]: val })
    }
    return key
  }

  patch(content: string) {
    for (const [key, value] of Object.entries(this.pool)) {
      content = content.replaceAll(key, value)
    }
    return content
  }

  simplify(content: string) {
    //console.log('simplify ', content)
    //auto caching
    const find = /\(data:image\/(jpeg|png);base64,.*\)/g
    let match: RegExpExecArray
    while ((match = find.exec(content)) !== null) {
      const matchStr = match[0]
      const val = matchStr.substring(1, matchStr.length - 1)
      this.cache(val)
    }
    //replace long str with short
    for (const [key, value] of Object.entries(this.pool)) {
      content = content.replaceAll(value, key)
    }
    return content
  }
}

function pngToJpg(dataURL: string) {
  return new Promise<string>(resolve => {
    var image = new Image()
    image.onload = () => {
      var canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext("2d").drawImage(image, 0, 0)
      dataURL = canvas.toDataURL("image/jpeg", .75)
      resolve(dataURL)
    }
    image.src = dataURL
  })
}

type OnSave = (content: string) => Promise<void>

class EditorContext {
  private config: Config
  public onSave: OnSave
  blocks = new Blocks()
  decorations: monaco.editor.IEditorDecorationsCollection
  editor: monaco.editor.IStandaloneCodeEditor
  editorDiv: HTMLDivElement
  mdEngine = new MarkdownIt()
  pool = new DataPool
  viewerDiv: HTMLDivElement

  constructor() {
    this.select = _.debounce(this.select, 100)
    const { mdEngine } = this
    mdEngine.use(InjectLineNumber)
    mdEngine.use(markdownContainer, 'warning')
    mdEngine.use(markdownTaskLists)
  }

  addParser(language: string, handle: Handle) {
    addParser(language, handle)
  }

  private createSuggestions(range: monaco.IRange) {
    const kind = monaco.languages.CompletionItemKind.Function
    return this.config.suggestions.map(s => {
      let { name: label, syntax: insertText, documentation } = s
      if (documentation && documentation.startsWith('-')) {
        const markdown: monaco.IMarkdownString = {
          value: documentation.substring(1)
        }
        documentation = markdown as any
      }
      return {
        label, insertText, documentation,
        kind, range
      } as monaco.languages.CompletionItem
    })
  }

  private onEditorScroll() {
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

  init() {

    this.blocks.context = this
    const editor = this.editor = monaco.editor.create(this.editorDiv, {
      fontSize: 20, wordWrap: 'on',
      glyphMargin: false, smoothScrolling: false, automaticLayout: true,
      theme: 'vs-dark', lineNumbersMinChars: 3, minimap: { enabled: false },
      language: "markdown"
    }, {})

    editor.onDidScrollChange(() => this.onEditorScroll())

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
          suggestions: this.createSuggestions(range)
        }
      }
    })
    parserList.forEach(p => {
      monaco.languages.register({ id: p.language })
    })

    document.addEventListener('keydown', async evt => {
      if (evt.key == 'v' && evt.ctrlKey) {  //enable image paste
        let imageText = ''
        const clipboardItems = await navigator.clipboard.read()
        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            if (type == 'image/png') {
              const base64_png = await blobToBase64(await clipboardItem.getType(type))
              const base64_jpeg = await pngToJpg(base64_png)
              const ratio = base64_jpeg.length / base64_png.length
              console.log('jpeg ratio: ', ratio.toFixed(2))
              const base64 = ratio > 1 ? base64_png : base64_jpeg
              imageText = `![Image](${this.pool.cache(base64)})`
              //console.log('imageText: ', imageText)
            }
          }
        }
        if (imageText) {
          editor.trigger("source", "undo", null)
          navigator.clipboard.writeText(imageText)
          editor.trigger('source', 'editor.action.clipboardPasteAction', null)
          editor.revealLineNearTop(editor.getPosition().lineNumber)
        }
      }
      if (evt.key == 's' && evt.ctrlKey) {//disable browser save
        evt.preventDefault()
        this.save()
      }
    })
    document.addEventListener('mousemove', onMouseMove)

    //remove command palette from menu
    deleteAction(['editor.action.quickCommand'])
    //alwasy expandSuggestion 
    const storageService = StandaloneServices.get(createDecorator('storageService'))
    const { getBoolean } = storageService
    storageService.getBoolean = (key: string) => {
      if (key === 'expandSuggestionDocs') return true
      return getBoolean.call(storageService, key)
    }

    return editor
  }

  savedContent = "";
  hasChange() {
    return (this.savedContent !== this.getCode())
  }

  getCode() {
    const content = this.editor.getModel().getValue()
    return this.pool.patch(content)
  }

  onViewerScroll = () => {
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

  setCode(code: string) {
    const { viewerDiv, editor, mdEngine, blocks } = this

    const view = $(viewerDiv)
    view.html(mdEngine.render(code))

    const simplified = this.pool.simplify(code)

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
    //update block position for scrolling
    const viewTop = viewerDiv.getBoundingClientRect().top
    blocks.blocks.forEach(b => {
      b.position.inEditor = editor.getTopForLineNumber(b.start)
      b.position.inView = viewerDiv.querySelector(`[x-block='${b.index}']`)
        .getBoundingClientRect().top - viewTop
    })
  }

  /**
   * show selection also prepare position for scolling sync
   * @param selected 
   */
  select(selected: number) {
    const { viewerDiv, blocks } = this
    $(viewerDiv).find(`[x-block]`).removeClass('selected')
    $(viewerDiv).find(`[x-block='${selected}']`).addClass('selected')
    blocks.highlight(selected)
  }

  async save() {
    const content = this.getCode()
    if (this.onSave) await this.onSave(content)
    this.savedContent = content
  }

  static async create(code: string, onSave: OnSave) {
    const context = new EditorContext
    context.config = await (await fetch('./config.json')).json()
    context.onSave = onSave
    context.savedContent = code
    return context
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

function onMouseMove(e: MouseEvent) {
  Object.assign(MousePosition, {
    x: e.clientX,
    y: e.clientY
  })
}

function isMouseInElement(ele: HTMLElement) {
  const { left, right, top, bottom } = ele.getBoundingClientRect()
  return _.inRange(MousePosition.x, left, right) && _.inRange(MousePosition.y, top, bottom)
}

export { EditorContext }
export type { OnSave }