// middleware/guest.js
export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useAppState();
  
  if (isAuthenticated) {
    return navigateTo('/');
  }
});