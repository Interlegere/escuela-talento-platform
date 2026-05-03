export function isDevelopmentPreviewEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false
  }

  return process.env.NEXT_PUBLIC_ENABLE_DEV_PREVIEW === "true"
}

export function isInternalDebugToolsEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false
  }

  return process.env.NEXT_PUBLIC_ENABLE_INTERNAL_DEBUG_TOOLS === "true"
}

export function allowRequestedPreview(requested?: boolean) {
  return isDevelopmentPreviewEnabled() && requested === true
}
