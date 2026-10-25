"use client"

import * as React from "react"

let topLayerPortal: HTMLDivElement | null = null

function getTopLayerPortal(): HTMLDivElement | null {
  if (typeof document === "undefined") {
    return null
  }

  if (topLayerPortal?.isConnected) {
    return topLayerPortal
  }

  topLayerPortal = document.createElement("div")
  topLayerPortal.dataset.reactAriaTopLayer = ""
  topLayerPortal.style.display = "contents"
  document.body.appendChild(topLayerPortal)

  return topLayerPortal
}

function subscribe(): () => void {
  return () => {}
}

export function useTopLayerPortalContainer(): HTMLDivElement | null {
  return React.useSyncExternalStore(
    subscribe,
    getTopLayerPortal,
    () => null
  )
}
