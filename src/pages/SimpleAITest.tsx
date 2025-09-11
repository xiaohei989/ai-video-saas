import { useState } from 'react'
import aiContentService from '@/services/aiContentService'

export default function SimpleAITest() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const testAI = async () => {
    setLoading(true)
    setResult('')
    
    try {
      const metadata = await aiContentService.generateVideoMetadata({
        templateName: 'Baby Professional Interview',
        prompt: 'A cynical female reporter interviews a happy-go-lucky baby in a tiny taxi driver uniform with cap, sitting in a toy car.',
        parameters: {
          baby_profession: 'uber_driver',
          reporter_question: 'Driving strangers around all day, isn\'t it exhausting?',
          baby_response: 'No way! I meet so many interesting people!'
        },
        userLanguage: 'zh-CN'
      })
      
      setResult(JSON.stringify(metadata, null, 2))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setResult(`错误: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>AI内容生成简单测试</h1>
      <button 
        onClick={testAI} 
        disabled={loading}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px',
          backgroundColor: loading ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '生成中...' : '测试AI生成'}
      </button>
      
      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace'
        }}>
          {result}
        </div>
      )}
    </div>
  )
}