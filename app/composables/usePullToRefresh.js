// composables/usePullToRefresh.js
export const usePullToRefresh = () => {
  const pullDistance = ref(0)
  const isPulling = ref(false)
  const threshold = 80
  
  const onPull = async () => {
    // Срабатываем только если натянули достаточно
    if (pullDistance.value < threshold) {
      pullDistance.value = 0
      return
    }
    
    await refreshNuxtData()
    pullDistance.value = 0
  }
  
  return { pullDistance, isPulling, onPull }
}