import React from 'react'
import ThumbnailGenerator from '@/components/admin/ThumbnailGenerator'
import { Layout } from '@/components/layout/Layout'

export default function ThumbnailGeneratorPage() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <ThumbnailGenerator />
        </div>
      </div>
    </Layout>
  )
}