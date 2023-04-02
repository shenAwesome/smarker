import mermaid from "mermaid"
import React from "react"
import ReactDOM from "react-dom"
import { EditorContext, OnSave } from "./EditorContext"
import { EditorUI } from "./EditorUI"
import { MdEngine } from "./engine/MdEngine"

mermaid.mermaidAPI.initialize({
  pie: {
    useWidth: 500
  }
})

async function createEditor(container: HTMLElement,
  code: string, onSave?: OnSave) {
  const context = await EditorContext.create(code, onSave)
  context.engine = await (new MdEngine()).init()

  ReactDOM.render(
    <React.StrictMode>
      <EditorUI code={code} context={context} />
    </React.StrictMode>, container
  )
  return context
}

export { createEditor }

