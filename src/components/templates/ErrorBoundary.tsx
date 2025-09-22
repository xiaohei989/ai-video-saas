/**
 * Error Boundary Component
 * 模板页面错误边界组件
 */

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Templates Error Boundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">
              页面加载遇到问题
            </h2>
            <p className="text-gray-600 mb-4">
              模板页面出现了错误，请尝试刷新页面
            </p>
            <div className="space-x-2">
              <Button onClick={this.handleReset} variant="outline">
                重试
              </Button>
              <Button onClick={this.handleReload}>
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}