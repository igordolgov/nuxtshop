// composables/useScrollReveal.js
export const useScrollReveal = () => {
  const observer = ref(null)
  
  onMounted(() => {
    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.value.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '50px' }
    )
    
    document.querySelectorAll('.reveal').forEach(el => {
      observer.value.observe(el)
    })
  })
  
  onUnmounted(() => observer.value?.disconnect())
}