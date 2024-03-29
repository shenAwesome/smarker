import { taskLists } from '@hedgedoc/markdown-it-plugins'
import 'github-markdown-css'
import MarkdownIt from 'markdown-it'
import markdownContainer from 'markdown-it-container'

import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"

import { Viz } from "@aslab/graphvizjs"
import * as echarts from 'echarts'
import mermaid from "mermaid"
import JSON5 from 'json5'

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

    get parserList() {
        return parserList
    }

    constructor() {
        const { engine } = this
        engine.use(markdownContainer, 'warning')
        engine.use(taskLists)
        engine.use(InjectLineNumber)
    }

    private addParser(language: string, handle: Handle) {
        addParser(language, handle)
    }

    async init() {
        mermaid.mermaidAPI.initialize({
            securityLevel: 'strict',
            flowchart: { htmlLabels: false },
            pie: { useWidth: 500 }
        })
        const viz = await Viz.create()
        this.addParser('mermaid', (content, idx) => {
            const svg = mermaid.mermaidAPI.render('mermaid_' + idx, content)
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
        this.addParser('TABLE', content => {
            content = content.trim()
            const rows = content.split('\n')
            const head = rows.shift().split(',').map(c => c.trim()).map(c => `<th>${c}</th>`).join('')
            const body = rows.map(r => r.split(',').map(c => c.trim()).map(c => `<td>${c}</td>`).join(''))
            const bodyStr = body.map(b => `<tr>${b}</tr>`).join('')
            const ret = `<table>
                <thead><tr>${head}</tr></thead>
                <tbody>${bodyStr}</tbody>
            </table>`
            return ret
        })
        this.addParser('CHART', content => {
            // In SSR mode the first parameter does not need to be passed in as a DOM object
            const chart = echarts.init(null, null, {
                renderer: 'svg', // must use SVG mode
                ssr: true, // enable SSR
                width: 640, // need to specify height and width
                height: 480
            })
            chart.setOption(JSON5.parse(`{
                animation: false,
                ${content} 
            }` ))
            return chart.renderToSVGString()
        })
        return this
    }

    render(code: string) {
        return this.engine.render(code)
    }
}

export { MdEngine }

