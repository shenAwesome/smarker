import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'
import { Recevier } from './Recevier'

async function main() {
  const receiver = new Recevier
  const container = document.getElementById('root')
  /*
  createEditor(container, 'hello', code => {
    console.log('code: ', code)
  })
  */
  container.innerHTML = 'Hello!!!'
  const home = await receiver.home()
  await receiver.setTitle("hello world")
  console.log('ret: ', home)

  receiver.addListener('FormClosing', evt => {
    const ret = confirm("close?")
    if (!ret) evt.cancel = true
  })
}

main()
