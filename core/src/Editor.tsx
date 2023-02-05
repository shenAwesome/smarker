import React from "react"
import ReactDOM from "react-dom"
import { EditorContext } from "./EditorContext"
import { EditorUI } from "./EditorUI"
import { Viz } from "@aslab/graphvizjs"
import mermaid from "mermaid"

async function createEditor(container: HTMLElement,
  code: string, onSave: (code: string) => void) {
  const context = new EditorContext
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
    const svg = viz.layout(content)
    return svg
  })

  await context.preload()

  ReactDOM.render(
    <React.StrictMode>
      <EditorUI code={code} onSave={onSave} context={context} />
    </React.StrictMode>, container
  )
}

export { createEditor }

