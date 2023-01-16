import React from 'react'
import * as ReactDOM from 'react-dom'
import Editor from './Editor'
import './css/main.scss'
import './css/SplitPane.scss'

import { FocusStyleManager } from "@blueprintjs/core"
FocusStyleManager.onlyShowFocusOnTabs()


ReactDOM.render(
  <React.StrictMode>  <Editor /> </React.StrictMode>,
  document.getElementById('root')
)
