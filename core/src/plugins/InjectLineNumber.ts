
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

    const ruleNames = 'paragraph_open,heading_open,table_open,bullet_list_open,ordered_list_open'
    ruleNames.split(',').forEach(rule => {
        md.renderer.rules[rule] = injectLineNumbers
    })

    const fence = md.renderer.rules.fence
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
        const token = tokens[idx]
        //if (token.map) token.attrSet('x-src', String(token.map.join(":")))
        const srcStr = `x-src='${String(token.map.join(":"))}'`
        const language = token.info.trim()
        const parser = parserList.find(p => p.language == language)
        let ret = ''
        let content = escapeHtml(token.content)
        if (parser) {
            let handled = false
            try {
                content = parser.handle(token.content, idx, token)
                handled = true
            } catch (e) { }
            ret = `<div class='code custom language-${language} ${handled ? '' : 'error'}' ${srcStr}>
                ${content}
            </div>`
        } else {
            ret = `<pre ${srcStr} class='code language-${language}'<code>${content}</code></pre>\n`
        }
        return ret
        /* 
        return fence.call(null, tokens, idx, options, env, slf)
        */
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