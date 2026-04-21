/**
 * Bridge impératif pour Toast et ConfirmDialog.
 *
 * Les providers (ToastProvider / ConfirmProvider) enregistrent leur API
 * à l'initialisation via `registerToast()` / `registerConfirm()`.
 *
 * Les pages peuvent alors importer directement :
 *   import { toast, confirmDialog } from '../components/ui/bridge'
 *   toast.success('Sauvegardé')
 *   const ok = await confirmDialog({ title: 'Supprimer ?', variant: 'danger' })
 *   const motif = await confirmDialog({ requireInput: { label: 'Motif' } })
 *
 * Fallback: si un provider n'est pas monté (tests unitaires isolés,
 * erreurs précoces), on retombe gracieusement sur console ou window.*.
 */

let _toast = null
let _confirm = null

export function registerToast(api) {
  _toast = api
}

export function registerConfirm(api) {
  _confirm = api
}

function fallbackToast(variant) {
  return (message, opts) => {
    if (typeof window !== 'undefined' && window.console) {
      console[variant === 'error' ? 'error' : 'log'](`[${variant}]`, message, opts || '')
    }
    return 0
  }
}

export const toast = {
  show:    (payload) => _toast ? _toast.show(payload) : fallbackToast(payload?.variant || 'info')(payload?.message),
  success: (msg, opts) => _toast ? _toast.success(msg, opts) : fallbackToast('success')(msg, opts),
  error:   (msg, opts) => _toast ? _toast.error(msg, opts)   : fallbackToast('error')(msg, opts),
  warning: (msg, opts) => _toast ? _toast.warning(msg, opts) : fallbackToast('warning')(msg, opts),
  info:    (msg, opts) => _toast ? _toast.info(msg, opts)    : fallbackToast('info')(msg, opts),
  dismiss: (id) => _toast && _toast.dismiss(id),
}

export async function confirmDialog(opts) {
  if (_confirm) return _confirm(opts)
  // Fallback synchronized with window API
  if (opts?.requireInput) {
    return typeof window !== 'undefined' ? window.prompt(opts.message || opts.title || '') : null
  }
  const ok = typeof window !== 'undefined'
    ? window.confirm(opts?.message || opts?.title || 'Confirmer ?')
    : false
  return ok ? true : null
}
