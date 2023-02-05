import type MarkdownIt from "markdown-it/lib"
import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"

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
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
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

export { InjectLineNumber, addParser, parserList }
export type { Handle }
