import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import PortalDropdown from './portal-dropdown'

interface Option {
  value: string
  label: string
  icon?: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  showIcon?: boolean
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  className = '',
  showIcon = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Find the selected option
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="w-full px-2.5 py-1 text-xs border border-input bg-background rounded-md hover:bg-accent flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {showIcon && selectedOption?.icon && (
            <span>{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <PortalDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
      >
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={`w-full px-2.5 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2 ${
              value === option.value ? 'bg-accent' : ''
            }`}
            onClick={() => {
              onChange(option.value)
              setIsOpen(false)
            }}
          >
            {showIcon && option.icon && (
              <span>{option.icon}</span>
            )}
            <span>{option.label}</span>
          </button>
        ))}
      </PortalDropdown>
    </div>
  )
}

export default CustomSelect