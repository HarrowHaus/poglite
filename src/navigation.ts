const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/'

export function appHref(path = '/') {
  const clean = path.replace(/^\/+/, '')
  return clean ? base + clean : base
}

export function appPath(pathname = window.location.pathname) {
  const baseWithoutTrailingSlash = base === '/' ? '' : base.slice(0, -1)

  if (baseWithoutTrailingSlash && pathname.startsWith(baseWithoutTrailingSlash)) {
    const rest = pathname.slice(baseWithoutTrailingSlash.length)
    return rest || '/'
  }

  return pathname || '/'
}

export function navigate(path: string) {
  window.location.href = appHref(path)
}
