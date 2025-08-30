import React from 'react'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-4xl font-bold mb-4">样式测试页面</h1>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-primary text-primary-foreground p-4 rounded">Primary</div>
        <div className="bg-secondary text-secondary-foreground p-4 rounded">Secondary</div>
        <div className="bg-accent text-accent-foreground p-4 rounded">Accent</div>
      </div>
      
      <div className="bg-card text-card-foreground p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold mb-2">Card Component</h2>
        <p className="text-muted-foreground">This is a card with muted text</p>
        
        <div className="mt-4 space-x-2">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90">
            Primary Button
          </button>
          <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:opacity-90">
            Secondary Button
          </button>
          <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:opacity-90">
            Destructive Button
          </button>
        </div>
      </div>
      
      <div className="mt-8 p-4 border border-border rounded">
        <p>Border test area</p>
        <input type="text" className="mt-2 p-2 bg-input border border-border rounded w-full" placeholder="Input field" />
      </div>
    </div>
  )
}