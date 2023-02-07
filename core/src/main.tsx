import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'

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
}

function sleep(timeout: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, timeout)
  })
}

class Recevier {

  private timeout = 5 //sec
  private pool = [] as Request[]

  webview = null as any
  constructor() {
    const webview = this.webview = (window as any)?.chrome?.webview
    if (!webview) return
    const { pool } = this
    webview.addEventListener('message', (evt: any) => {
      console.log('evt: ', evt)
      if (evt.data?._type_ == 'Request') {
        const request = evt.data as Request
        pool.find(p => p.id == request.id).payload = request.payload || '-Null-'
      }
    })
  }

  private async request(method: string, parameters: string[]) {
    const { pool } = this
    const { webview } = this
    if (!webview) return
    const request = new Request(method, parameters)
    pool.push(request)
    webview.postMessage(request)
    const start = Date.now()
    while (true) {
      await sleep(200)
      if (request.payload) break
      if (Date.now() - start > this.timeout * 1000) break
    }
    _.pull(pool, request)
    const { payload } = request
    return payload == '-Null-' ? null : JSON.parse(request.payload.replaceAll(`\\\\`, '/'))
  }

  async home() {
    const ret = await this.request('Home', [])
    return ret as {
      Args: string[],
      Culture: string,
      ExecutablePath: string,
      LocalIPs: string[],
      MachineName: string,
      OSVersion: string,
      UserName: string,
      UserProfile: string
    }
  }

  async setTitle(title: string) {
    this.request('SetTitle', [title])
  }
}


class Request {
  public _type_ = "Request";
  public id: string
  public payload: string
  constructor(public method: string, public parameters: string[]) {
    this.id = Math.random() + '_' + Date.now()
  }
}

main()
