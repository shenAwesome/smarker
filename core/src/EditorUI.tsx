
import { useSize } from "ahooks"
import $ from "cash-dom"
import classNames from "classnames"
import 'github-markdown-css'
import _ from 'lodash'
import * as monaco from 'monaco-editor'
import React, { SyntheticEvent, useEffect, useState } from "react"
import { Item, ItemParams, Menu, useContextMenu } from 'react-contexify'
import 'react-contexify/ReactContexify.css'
import { FaArrowDown, FaArrowUp, FaEdit, FaPrint } from 'react-icons/fa'
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import { EditorContext } from "./EditorContext"
import './manaco/userWorker'
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

function createRef<T>(obj: T, key: keyof T) {
  return {
    set current(value: any) {
      obj[key] = value
    }
  }
}

interface EditorProps {
  code: string
  onSave: (content: string) => void
  context: EditorContext
}


function EditorUI({ code, onSave, context }: EditorProps) {
  const [_splitSize, setSplitSize] = useStorageInt('splitSize', 500)
  const [text, setText] = useState(code)
  const [selected, setSelected] = useState(-1)
  const { blocks } = context
  const minSize = 200

  const { show } = useContextMenu({ id: MENU_ID })
  const size = useSize(document.querySelector('body'))
  const splitSize = Math.min(_splitSize, (size ? size.width : 4000) - 200)

  useEffect(() => {//first time

    const { editorDiv } = context
    const editor = monaco.editor.create(editorDiv, {
      fontSize: 20, wordWrap: 'on',
      glyphMargin: false, smoothScrolling: false, automaticLayout: true,
      theme: 'vs-dark', lineNumbersMinChars: 3, minimap: { enabled: false },
      language: "markdown"
    })

    context.editorCreated(editor, onSave)

    editor.onDidChangeModelContent(_.debounce(() => {
      setText(context.getCode())
    }, 200))

    editor.onDidChangeCursorPosition(() => {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    })
  }, [])

  useEffect(() => {//on text changed
    const { viewerDiv, editor, mdEngine } = context

    const view = $(viewerDiv)
    view.html(mdEngine.render(text))

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

  return <>
    <div className={classNames("MDEditor", { hideEditor: !showEditor })}    >
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

export { EditorUI }

