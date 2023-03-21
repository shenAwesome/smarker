
import { useSize } from "ahooks"
import $ from "cash-dom"
import classNames from "classnames"
import 'github-markdown-css'
import _ from 'lodash'
import React, { SyntheticEvent, useEffect, useState } from "react"
import { Item, ItemParams, Menu, useContextMenu } from 'react-contexify'
import 'react-contexify/ReactContexify.css'
import { FaArrowDown, FaArrowUp, FaEdit, FaPrint } from 'react-icons/fa'
import SplitPane from 'react-split-pane'
import './css/Editor.scss'
import { EditorContext } from "./EditorContext"
const MENU_ID = 'mdEditorMenu'

function useRefresh() {
  const [_, setNum] = useState(0)
  return () => setNum(Date.now)
}

function useStorage<T extends Object>(key: string, defaultValue: T) {
  const refresh = useRefresh()
  const saved = localStorage.getItem(key)
  let value = defaultValue
  if (saved) {
    try {
      value = JSON.parse(saved)
    } catch (e) { }
  }
  const setValue = (val: Partial<T>) => {
    val = { ...value, ...val }
    localStorage.setItem(key, JSON.stringify(val))
    refresh()
  }
  return [value, setValue] as [T, (val: Partial<T>) => void]
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
  context: EditorContext
}


function EditorUI({ code, context }: EditorProps) {
  const [config, setConfig] = useStorage('mdreader_config', {
    splitSize: 500,
    showEditor: true
  })

  const [text, setText] = useState(code)
  const [selected, setSelected] = useState(-1)
  const { blocks } = context
  const minSize = 200
  const { show } = useContextMenu({ id: MENU_ID })
  const size = useSize(document.querySelector('body'))
  const splitSize = Math.min(config.splitSize, (size ? size.width : 4000) - 200)

  function sleep(delay: number) {
    return new Promise<void>(resolve => {
      window.setTimeout(resolve, delay)
    })
  }

  useEffect(() => {//first time

    const editor = context.init()

    function updateSelection() {
      const pos = editor.getPosition()
      const block = blocks.getByLine(pos.lineNumber)
      if (block) setSelected(block.index)
    }

    editor.onDidChangeModelContent(_.debounce(async () => {
      setText(context.getCode())
      await sleep(200)
      updateSelection()
    }, 200))

    editor.onDidChangeCursorPosition(updateSelection)

  }, [])

  const { showEditor } = config
  const _selected = showEditor ? selected : -1

  useEffect(() => {//on text changed
    context.setCode(text)
    context.select(_selected)
    if ((!showEditor) && (text.trim() == '')) setConfig({ showEditor: true })
  }, [text])

  async function viewClicked(event: SyntheticEvent<HTMLDivElement, MouseEvent>) {
    if (!showEditor) return

    const target = (event.target as HTMLElement).closest('[x-src]'),
      blockIdx = target ? parseInt(target.getAttribute('x-block')) : -1,
      block = context.blocks.get(blockIdx)
    setSelected(blockIdx)

    if (block) {
      await sleep(200)
      const { editor, editorDiv } = context
      const lineNumber = block.start
      editor.setPosition({ lineNumber, column: 0 })
      editor.focus()
      const scrollTop = editor.getScrollTop()
      if (!_.inRange(editor.getTopForLineNumber(lineNumber), scrollTop, scrollTop + editorDiv.clientHeight)) {
        editor.revealLineNearTop(lineNumber)
      }
    }
  }

  useEffect(() => {
    context.select(_selected)
  }, [_selected])

  function onContextMenu(event: React.MouseEvent) {
    show({ event })
  }

  const handleItemClick = _.debounce(({ id }: ItemParams) => {
    const viewerContainer = context.viewerDiv.parentElement
    switch (id) {
      case "edit":
        setConfig({ showEditor: !showEditor })
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
        size={splitSize} onChange={size => setConfig({ splitSize: size })} >
        <div className='SPane left'>
          <main>
            <div className="monacoEditor" ref={createRef(context, "editorDiv")}></div>
          </main>
        </div>
        <div className='SPane right mdView' onScroll={context.onViewerScroll} onContextMenu={onContextMenu}>
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

