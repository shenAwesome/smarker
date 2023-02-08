import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'


function sleep(timeout: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, timeout)
  })
}

interface FormEvent {
  type: string
  payload: any
  cancel: boolean
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
      if (evt.data?._type_ == 'Request') {
        const request = evt.data as Request
        pool.find(p => p.id == request.id).payload = request.payload || '-Null-'
      }
    })

    const fireFormEvent = (evtJSON: string) => {
      const evt = JSON.parse(evtJSON)
      this.onEvent(evt)
      return (evt.cancel == true)
    }
    Object.assign(window, { fireFormEvent })
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

  onEvent(evt: FormEvent) {
    this.listeners.filter(l => l.type == evt.type).forEach(l => l.handle(evt))
  }

  private listeners = [] as Listener[]
  addListener(type: string, handle: EventHandle) {
    this.listeners.push(new Listener(type, handle))
  }

  async setTitle(title: string) {
    this.request('SetTitle', [title])
  }
}

type EventHandle = (evt: FormEvent) => void
class Listener {
  constructor(public type: string, public handle: EventHandle) { }
}


class Request {
  public _type_ = "Request";
  public id: string
  public payload: string
  constructor(public method: string, public parameters: string[]) {
    this.id = Math.random() + '_' + Date.now()
  }
}

export { Recevier }