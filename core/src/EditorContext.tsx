
import $ from "cash-dom"
import 'github-markdown-css'
import _ from 'lodash'

import * as monaco from 'monaco-editor'
import 'react-contexify/ReactContexify.css'
import './css/Editor.scss'
import './manaco/userWorker'

import { createDecorator } from 'monaco-editor/esm//vs/platform/instantiation/common/instantiation'
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices"
import * as _actions from "monaco-editor/esm/vs/platform/actions/common/actions"
import { MdEngine } from './engine/MdEngine'

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
  engine: MdEngine
  pool = new DataPool
  _viewerDiv: HTMLDivElement

  set viewerDiv(div: HTMLDivElement) {
    this._viewerDiv = div
    if (div) {
      if ((div as any)['cleanup']) (div as any)['cleanup']()
      const onSizeChange = _.debounce(() => this.updatePosition(), 100)
      const ob = new ResizeObserver(onSizeChange)
      ob.observe(div)
      const cleanup = () => ob.disconnect()
      Object.assign(div, { cleanup })
    }
  }

  get viewerDiv() {
    return this._viewerDiv
  }

  constructor() {
    this.select = _.debounce(this.select, 100)
    //this.updatePosition = _.debounce(this.updatePosition, 100)
  }

  private _createSuggestions(range: monaco.IRange) {
    const kind = monaco.languages.CompletionItemKind.Snippet

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

  private createSuggestions() {
    const { editor, config } = this,
      range = editor.getSelection(),
      selected = editor.getModel().getValueInRange(range),
      enable = editor.getPosition().column == 1 && !selected

    return enable ? config.suggestions.map(s => {
      let { name: label, syntax: insertText, documentation } = s
      if (documentation && documentation.startsWith('-')) {
        const markdown: monaco.IMarkdownString = {
          value: documentation.substring(1)
        }
        documentation = markdown as any
      }
      const kind = monaco.languages.CompletionItemKind.Snippet
      return {
        label, insertText, documentation,
        kind, range
      } as monaco.languages.CompletionItem
    }) : []
  }

  private onEditorScroll() {
    console.log('scroll')
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
      provideCompletionItems: () => ({
        suggestions: this.createSuggestions()
      })
    })

    this.engine.parserList.forEach(p => {
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
              //console.log('jpeg ratio: ', ratio.toFixed(2))
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

    const getSelection = () => {
      return editor.getModel().getValueInRange(editor.getSelection())
    }

    editor.onKeyDown((e) => {
      if (e.code.startsWith('Key') && e.ctrlKey) {
        const selection = getSelection()
        const key = e.code.replace('Key', '')
        const enhancement = this.config.enhancements.find(c => c.key == key)
        if (enhancement) {
          e.preventDefault()
          e.stopPropagation()
          if (selection) {
            // const text = enhancement.syntax
            let text = selection
            const { syntax } = enhancement
            if (enhancement.multiline) {
              const lines = selection.split('\n').map(line => {
                //clean up multiline syntax
                const formats = this.config.enhancements.filter(e => e.multiline).map(e => e.syntax.split(' ')[0] + ' ')
                formats.forEach(f => {
                  if (line.startsWith(f)) {
                    line = line.substring(f.length)
                  }
                })
                return line.trim()
              }).filter(t => !!t)
                .map(l => syntax.replace('{0}', l))
              text = lines.join('\n')
            } else {
              text = syntax.replace('{0}', text)
            }
            editor.executeEdits(null, [{
              range: editor.getSelection(),
              text, forceMoveMarkers: true
            }])
          }
        }
      }
    })

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

  //update block position for scrolling  
  updatePosition() {
    console.log('updatePosition: ')
    const { viewerDiv, editor, blocks } = this
    const viewTop = viewerDiv.getBoundingClientRect().top
    blocks.blocks.forEach(b => {
      b.position.inEditor = editor.getTopForLineNumber(b.start)
      b.position.inView = viewerDiv.querySelector(`[x-block='${b.index}']`)
        .getBoundingClientRect().top - viewTop
    })
    this.onEditorScroll()
  }

  setCode(code: string) {
    const { viewerDiv, editor, engine, blocks } = this

    const view = $(viewerDiv)
    view.html(engine.render(code))
    view.parent().toggleClass('empty', view.children().length == 0)

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


    const { _selected: selected } = this
    $(viewerDiv).find(`[x-block]`).removeClass('selected')
    $(viewerDiv).find(`[x-block='${selected}']`).addClass('selected')

    this.updatePosition()
  }

  _selected = -1
  /**
   * show selection also prepare position for scolling sync
   * @param selected 
   */
  select(selected = this._selected) {
    const { viewerDiv, blocks } = this
    $(viewerDiv).find(`[x-block]`).removeClass('selected')
    $(viewerDiv).find(`[x-block='${selected}']`).addClass('selected')
    blocks.highlight(selected)
    this._selected = selected
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
interface Enhancement {
  name: string,
  syntax: string
  key: string
  multiline: boolean
}

interface Config {
  suggestions: Suggestion[]
  enhancements: Enhancement[]
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

