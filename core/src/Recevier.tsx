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

const webview = (window as any)?.chrome?.webview
if (webview) webview.addEventListener('message', (evt: any) => {
  if ((window as any)['onWebViewMessage']) {
    (window as any)['onWebViewMessage'](evt)
  }
})

class Recevier {

  private timeout = 5 //sec
  private pool = [] as Request[]

  constructor() {
    if (!webview) return
    const { pool } = this

    const onWebViewMessage = (evt: any) => {
      if (evt.data?._type_ == 'Request') {
        const request = evt.data as Request
        pool.find(p => p.id == request.id).payload = request.payload || '-Null-'
      }
    }

    const fireFormEvent = (evtJSON: string) => {
      const evt = JSON.parse(evtJSON) as FormEvent
      this.onEvent(evt)
      return (evt.cancel == true)
    }

    Object.assign(window, { fireFormEvent, onWebViewMessage })
  }

  private async request(method: string, parameters: string[] = []) {
    const { pool } = this
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
    if (request.error) {
      console.error(request.error)
    }
    const payload = (request.payload + "").replaceAll(`\\\\`, '/')
    //console.log('payload: ', payload, JSON.parse(payload))
    return (payload == '-Null-') ? null : JSON.parse(payload)
  }

  async home() {
    const ret = await this.request('Home', []) as {
      Args: string[],
      Culture: string,
      ExecutablePath: string,
      LocalIPs: string[],
      MachineName: string,
      OSVersion: string,
      UserName: string,
      UserProfile: string
    }
    return ret
  }

  async readFile(path: string) {
    return await this.request('ReadFile', [path]) as string
  }

  async writeFile(path: string, content: string) {
    path = await this.request('WriteFile', [path, content]) as string
    console.log('path: ', path)
    return path
  }

  async closeForm() {
    await this.request('CloseForm', [])
  }

  private onEvent(evt: FormEvent) {
    const listeners = this.listeners.filter(l => l.type == evt.type)
    for (const l of listeners) l.handle(evt)
  }

  private listeners = [] as Listener[]
  addListener(type: string, handle: EventHandle) {
    this.listeners.push(new Listener(type, handle))
  }

  async setTitle(title: string) {
    this.request('SetTitle', [title])
  }

  onClose(onClose: () => Promise<boolean>) {
    this.addListener('FormClosing', async () => {
      const ret = await onClose()
      if (ret) this.closeForm()
    })
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
  public error: string
  constructor(public method: string, public parameters: string[]) {
    this.id = Math.random() + '_' + Date.now()
  }
}

export { Recevier }