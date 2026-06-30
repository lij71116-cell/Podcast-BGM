import axios from 'axios'
import type { ApiResponse } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  withCredentials: true,
})

http.interceptors.response.use(
  (response) => response.data as ApiResponse<unknown> as never,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const url = error.config?.url ?? ''
      const body = error.response?.data as ApiResponse<null> | undefined

      if (
        status === 401 &&
        import.meta.env.VITE_USE_MOCK !== 'true' &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/register') &&
        !url.includes('/auth/me')
      ) {
        useAuthStore.getState().clearUser()
      }

      if (body?.message) {
        return Promise.reject(new Error(body.message))
      }
      if (status === 404 && url.includes('/auth/')) {
        return Promise.reject(
          new Error('认证服务不可用（404）：后端可能尚未部署 V2，请稍后重试或联系管理员'),
        )
      }
      if (status === 404 && import.meta.env.VITE_USE_MOCK === 'true') {
        return Promise.reject(
          new Error('接口 Mock 未实现，请刷新页面；汽水音乐真实解析需 VITE_USE_MOCK=false 并登录'),
        )
      }
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new Error('请求超时，请稍后重试'))
      }
      if (error.message === 'Network Error') {
        return Promise.reject(new Error('网络连接失败，请检查网络后重试'))
      }
    }
    return Promise.reject(error)
  },
)

export default http
