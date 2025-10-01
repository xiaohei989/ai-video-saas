import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X } from '@/components/icons'
import { Card } from '@/components/ui/card'

interface ImageUploaderProps {
  label: string
  value: File | null
  onChange: (file: File | null) => void
  required?: boolean
}

export default function ImageUploader({
  label,
  value,
  onChange,
  required = false
}: ImageUploaderProps) {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 初始化preview状态从传入的value
  useEffect(() => {
    if (value) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(value)
    } else {
      setPreview(null)
    }
  }, [value])

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      onChange(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = () => {
    onChange(null)
    setPreview(null)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      <Card
        className="border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={!preview ? handleClick : undefined}
      >
        <div className="p-6">
          {preview ? (
            <div className="relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full h-auto rounded-md"
              />
              <button
                className="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-black/90 text-white rounded-full flex items-center justify-center transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">{t('imageUploader.clickToUpload')}</p>
              <p className="text-xs text-center">
                {t('imageUploader.formatRequirements')}
              </p>
            </div>
          )}
        </div>
      </Card>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
        className="hidden"
      />
    </div>
  )
}