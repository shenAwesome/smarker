import React from 'react'
import * as ReactDOM from 'react-dom'
import { Editor, preload } from './Editor'
import './css/main.scss'
import './css/SplitPane.scss'

async function main() {
  await preload()
  ReactDOM.render(
    <React.StrictMode>  <Editor /> </React.StrictMode>,
    document.getElementById('root')
  )
}

main()
