
import { Viz } from "@aslab/graphvizjs"
import type MarkdownIt from "markdown-it/lib"
import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"
import mermaid from "mermaid"

const { mermaidAPI } = mermaid

const viz = await Viz.create()

function injectLineNumbers(tokens: Token[], idx: number, options: MarkdownIt.Options,
    env: any, slf: Renderer) {
    const token = tokens[idx]
    if (token.map) {
        token.attrSet('x-src', String(token.map.join(":")))
    }
    return slf.renderToken(tokens, idx, options)
}

function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

type Handle = (content: string, index: number, token: Token,) => string

class Parser {
    constructor(public readonly language: string,
        public readonly handle: Handle) {

    }
}

const parserList = [] as Parser[]

function addParser(language: string, handle: Handle) {
    parserList.push(new Parser(language, handle))
}

function InjectLineNumber(md: MarkdownIt) {
    md.renderer.rules.paragraph_open = injectLineNumbers
    md.renderer.rules.heading_open = injectLineNumbers
    md.renderer.rules.table_open = injectLineNumbers

    const fence = md.renderer.rules.fence
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
        const token = tokens[idx]
        if (token.map) token.attrSet('x-src', String(token.map.join(":")))
        const srcStr = `x-src='${String(token.map.join(":"))}'`
        const language = token.info.trim()
        const parser = parserList.find(p => p.language == language)
        if (parser) try {
            const parsed = parser.handle(token.content, idx, token) || token.content
            return `<div class='custom language-${language}' ${srcStr}>
                ${parsed}
            </div>`
        } catch (e) {
            return `<div class='custom language-${language} error' ${srcStr}>
                ${escapeHtml(token.content)}
            </div>`
        }

        return fence.call(null, tokens, idx, options, env, slf)
    }


}

addParser('mermaid', (content, idx) => {
    const svg = mermaidAPI.render('mermaid_' + idx, content)
    return svg
})

addParser('dot', content => {
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

export { InjectLineNumber, addParser, parserList }