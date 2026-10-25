"use client"

import * as React from "react"

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

export function useTopLayerRef<T extends HTMLElement>(
  forwardedRef?: React.Ref<T>
) {
  return React.useCallback(
    (node: T | null) => {
      const wrapper = node?.parentElement

      if (wrapper && wrapper.style.display === "contents") {
        wrapper.dataset.reactAriaTopLayer = ""
      }

      assignRef(forwardedRef, node)
    },
    [forwardedRef]
  )
}

export function shouldCloseModalOnInteractOutside(
  target: Element,
  shouldCloseOnInteractOutside?: (target: Element) => boolean
) {
  if (shouldCloseOnInteractOutside && !shouldCloseOnInteractOutside(target)) {
    return false
  }

  if (
    target.closest(
      '[data-slot="select-content"], [data-slot="popover-content"]'
    )
  ) {
    return false
  }

  if (typeof document === "undefined") {
    return true
  }

  return !document.querySelector(
    '[data-slot="select-content"], [data-slot="popover-content"]'
  )
}
