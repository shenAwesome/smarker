import { taskLists } from '@hedgedoc/markdown-it-plugins'
import 'github-markdown-css'
import MarkdownIt from 'markdown-it'
import markdownContainer from 'markdown-it-container'

import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"

import { Viz } from "@aslab/graphvizjs"
import mermaid from "mermaid"

import "./MdEngine.scss"

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
    md.renderer.rules.fence = function (tokens, idx) {
        const token = tokens[idx]
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
    }
}

class MdEngine {

    private engine = new MarkdownIt()

    constructor() {
        const { engine } = this
        engine.use(markdownContainer, 'warning')
        engine.use(taskLists)
        engine.use(InjectLineNumber)
    }

    get parserList() {
        return parserList
    }

    async init() {
        mermaid.mermaidAPI.initialize({
            pie: {
                useWidth: 500
            }
        })
        const viz = await Viz.create()
        this.addParser('mermaid', (content, idx) => {
            const svg = mermaid.mermaidAPI.render('mermaid_' + idx, content)
            console.log('svg: ', svg)
            return svg
        })
        this.addParser('DOT', content => {
            content = content.trim()
            if (!(content.startsWith('digraph') || content.startsWith('graph'))) {
                const head = content.includes('->') ? 'digraph' : 'graph'
                content = ` ${head} { 
                ${content}
              }`
            }
            return viz.layout(content)
        })
        return this
    }

    addParser(language: string, handle: Handle) {
        addParser(language, handle)
    }

    render(code: string) {
        return this.engine.render(code)
    }
}

export { MdEngine }

