
import type MarkdownIt from "markdown-it/lib"
import Renderer from "markdown-it/lib/renderer"
import Token from "markdown-it/lib/token"


function injectLineNumbers(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, slf: Renderer) {
    const token = tokens[idx]
    if (token.map) {
        const line = token.map[0] + 1
        token.attrSet('x-src', String(line))
    }
    return slf.renderToken(tokens, idx, options)
}


function InjectLineNumber(md: MarkdownIt) {
    md.renderer.rules.paragraph_open = injectLineNumbers
    md.renderer.rules.heading_open = injectLineNumbers
}

export { InjectLineNumber }