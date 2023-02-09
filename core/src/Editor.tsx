import React from "react"
import ReactDOM from "react-dom"
import { EditorContext, OnSave } from "./EditorContext"
import { EditorUI } from "./EditorUI"
import { Viz } from "@aslab/graphvizjs"
import mermaid from "mermaid"

async function createEditor(container: HTMLElement,
  code: string, onSave: OnSave) {
  const context = await EditorContext.create(code, onSave)
  const viz = await Viz.create()
  context.addParser('mermaid', (content, idx) => {
    const svg = mermaid.mermaidAPI.render('mermaid_' + idx, content)
    return svg
  })
  context.addParser('dot', content => {
    content = content.trim()
    if (!(content.startsWith('digraph') || content.startsWith('graph'))) {
      const head = content.includes('->') ? 'digraph' : 'graph'
      content = ` ${head} { 
        ${content}
      }`
    }
    return viz.layout(content)
  })

  ReactDOM.render(
    <React.StrictMode>
      <EditorUI code={code} context={context} />
    </React.StrictMode>, container
  )
  return context
}

export { createEditor }

