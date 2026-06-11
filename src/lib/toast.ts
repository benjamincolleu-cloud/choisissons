import type { ToastEntry } from '../types'

let _toastHandler: ((entry: ToastEntry) => void) | null = null
let _toastCounter = 0

export function showToast(message: string, type: 'error' | 'warning' | 'info' = 'error'): void {
  _toastHandler?.({ id: ++_toastCounter, message, type })
}

export function setToastHandler(handler: ((entry: ToastEntry) => void) | null): void {
  _toastHandler = handler
}
