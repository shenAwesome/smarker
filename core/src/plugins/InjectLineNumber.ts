
import type MarkdownIt from "markdown-it/lib"
import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"
import mermaid from "mermaid"

const { mermaidAPI } = mermaid

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
        .replace(/'/g, "&#039;");
}

function InjectLineNumber(md: MarkdownIt) {
    md.renderer.rules.paragraph_open = injectLineNumbers
    md.renderer.rules.heading_open = injectLineNumbers
    md.renderer.rules.table_open = injectLineNumbers

    const fence = md.renderer.rules.fence
    md.renderer.rules.fence = function (tokens, idx, options, env, slf) {
        const token = tokens[idx];
        if (token.map) {
            token.attrSet('x-src', String(token.map.join(":")))
        }
        const srcStr = `x-src='${String(token.map.join(":"))}'`
        console.log(token.info)
        if (token.info.trim() == 'mermaid') {
            const svg = mermaidAPI.render('_', token.content)
            return `<div class='MermaidDiagram' ${srcStr}>
                ${svg}
            </div>`
        }

        //const result = fence.call(null, tokens, idx, options, env, slf)
        //return result.replace('<pre>', `<pre> ${srcStr}`)
        return fence.call(null, tokens, idx, options, env, slf)
    }
    console.log('md.renderer.rules: ', md.renderer.rules);
}

export { InjectLineNumber }