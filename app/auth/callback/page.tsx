'use client'

/**
 * Auth Callback Page
 *
 * Handles magic link authentication callbacks from Supabase
 */

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/db/supabase'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get auth code from URL
        const code = searchParams.get('code')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (errorParam) {
          setStatus('error')
          setError(errorDescription || errorParam)
          return
        }

        if (code) {
          // Exchange code for session
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            setStatus('error')
            setError(error.message)
            return
          }

          setStatus('success')

          // Redirect to dashboard after short delay
          setTimeout(() => {
            const redirectTo = searchParams.get('redirectTo') || '/projects'
            router.push(redirectTo)
          }, 1500)
        } else {
          // No code, check if already logged in
          const { data: { session } } = await supabase.auth.getSession()

          if (session) {
            setStatus('success')
            setTimeout(() => {
              router.push('/projects')
            }, 1000)
          } else {
            setStatus('error')
            setError('无效的认证链接')
          }
        }
      } catch (err) {
        setStatus('error')
        setError('认证过程中发生错误')
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">验证中...</h2>
            <p className="text-gray-500">请稍候</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">登录成功！</h2>
            <p className="text-gray-500">正在跳转到项目管理...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">认证失败</h2>
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              返回登录
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function AuthCallbackLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-blue-200 rounded-full border-t-blue-600 animate-spin" />
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
