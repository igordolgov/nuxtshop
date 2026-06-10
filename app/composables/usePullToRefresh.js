// composables/usePullToRefresh.js
export const usePullToRefresh = () => {
  const pullDistance = ref(0)
  const isPulling = ref(false)
  const threshold = 80
  
  const onPull = async () => {
    await refreshNuxtData()
    pullDistance.value = 0
  }
  
  return { pullDistance, isPulling, onPull }
}