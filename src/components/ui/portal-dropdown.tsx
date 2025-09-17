import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface PortalDropdownProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement>
  children: React.ReactNode
  className?: string
}

export function PortalDropdown({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = ''
}: PortalDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  // 计算下拉菜单位置
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
      
      setPosition({
        top: triggerRect.bottom + scrollTop,
        left: triggerRect.left + scrollLeft,
        width: triggerRect.width
      })
    }
  }, [isOpen, triggerRef])

  // 处理点击外部关闭
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // 检查点击是否在触发器或下拉菜单内
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      
      onClose()
    }

    // 延迟添加事件监听器，避免立即触发
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose, triggerRef])

  // 处理窗口大小变化
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      if (triggerRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
        
        setPosition({
          top: triggerRect.bottom + scrollTop,
          left: triggerRect.left + scrollLeft,
          width: triggerRect.width
        })
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleResize)
    }
  }, [isOpen, triggerRef])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      className={`fixed bg-card border border-border rounded-md shadow-xl z-[999999] max-h-64 overflow-y-auto ${className}`}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: position.width
      }}
    >
      {children}
    </div>,
    document.body
  )
}

export default PortalDropdown