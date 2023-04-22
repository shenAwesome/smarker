import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'
import { Editor, createEditor } from './Editor'
import { Receiver } from './Receiver'

async function main() {

  const container = document.getElementById('root')
  document.addEventListener('contextmenu', evt => evt.preventDefault())

  const receiver = new Receiver
  if (receiver.isConnected) { //inside webview2
    const home = await receiver.home()
    let filePath = home.Args[1] || ''
    console.log('filePath: ', filePath)
    const fileContent = filePath ? await receiver.readFile(filePath) : ''
    const editor = await createEditor(container, fileContent, receiver)
    editor.path = filePath
    await receiver.setTitle(filePath)
    //auto save when close
    receiver.onClose(async () => {
      await editor.save()
      return true
    })
    //reload whole page , happens when user open another file when a file is already open
    receiver.addListener("Reload", async () => {
      console.log('reload')
      await editor.save()
      location.reload()
    })

    editor.openURL = (url: string) => receiver.openURL(url)
  } else {//inside web browser, for testing
    const content = ` 
hello
    `
    await createEditor(container, content)
  }
}

main()


export { main }