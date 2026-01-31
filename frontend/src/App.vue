<script setup>
import { ref, provide, onMounted, onUnmounted, nextTick } from 'vue'

// Import all views as components
import HomeView from './views/HomeView.vue'
import ComprendreView from './views/ComprendreView.vue'
import OptionsView from './views/OptionsView.vue'
import AidesView from './views/AidesView.vue'
import FaqView from './views/FaqView.vue'
import EnqueteView from './views/EnqueteView.vue'

const sections = [
  { id: 'accueil', label: 'Accueil', component: HomeView },
  { id: 'comprendre', label: 'Comprendre', component: ComprendreView },
  { id: 'options', label: 'Options', component: OptionsView },
  { id: 'aides', label: 'Financement', component: AidesView },
  { id: 'faq', label: 'FAQ', component: FaqView },
]

const currentSection = ref(0)
const isEnqueteOpen = ref(false)
const scrollContainer = ref(null)
const isScrolling = ref(false)
const lastScrollTop = ref(0)
const headerHidden = ref(false)
const scrollAnimationId = ref(null)
const scrollEndTimeout = ref(null)
const lastScrollTime = ref(0)
const scrollVelocity = ref(0)

/** Ease-in-out cubic for smooth start/end. */
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Ease-out for snap animation */
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

const openEnquete = () => {
  isEnqueteOpen.value = true
  document.body.style.overflow = 'hidden'
}

// Provide openEnquete to all child components
provide('openEnquete', openEnquete)

// Provide section navigation
const navigateToSection = (sectionId) => {
  const index = sections.findIndex(s => s.id === sectionId)
  if (index !== -1) {
    scrollToSection(index)
  }
}
provide('navigateToSection', navigateToSection)

const closeEnquete = () => {
  isEnqueteOpen.value = false
  document.body.style.overflow = ''
}
provide('closeEnquete', closeEnquete)

const SCROLL_DURATION_MS = 1100

const scrollToSection = (index) => {
  const container = scrollContainer.value
  const section = container?.children[index]
  if (!container || !section) return

  if (scrollAnimationId.value != null) {
    cancelAnimationFrame(scrollAnimationId.value)
    scrollAnimationId.value = null
  }

  const startTop = container.scrollTop
  const targetTop = section.offsetTop
  if (startTop === targetTop) {
    currentSection.value = index
    location.hash = sections[index].id
    return
  }

  isScrolling.value = true
  currentSection.value = index
  location.hash = sections[index].id
  headerHidden.value = false

  const startTime = performance.now()

  const tick = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / SCROLL_DURATION_MS, 1)
    const eased = easeInOutCubic(progress)
    container.scrollTop = startTop + (targetTop - startTop) * eased

    if (progress < 1) {
      scrollAnimationId.value = requestAnimationFrame(tick)
    } else {
      container.scrollTop = targetTop
      isScrolling.value = false
      scrollAnimationId.value = null
    }
  }

  scrollAnimationId.value = requestAnimationFrame(tick)
}

/** Find the nearest section to snap to based on scroll position */
const findNearestSection = (scrollTop, viewportHeight) => {
  const container = scrollContainer.value
  if (!container) return 0

  let nearestSection = 0
  let nearestDistance = Infinity

  for (let i = 0; i < container.children.length; i++) {
    const section = container.children[i]
    const sectionTop = section.offsetTop - container.offsetTop
    const distance = Math.abs(scrollTop - sectionTop)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestSection = i
    }
  }

  return nearestSection
}

/** Smooth snap to nearest section */
const snapToNearestSection = () => {
  const container = scrollContainer.value
  if (!container || isScrolling.value) return

  const scrollTop = container.scrollTop
  const viewportHeight = container.clientHeight
  const nearestIndex = findNearestSection(scrollTop, viewportHeight)
  const section = container.children[nearestIndex]

  if (!section) return

  const targetTop = section.offsetTop - container.offsetTop
  const distance = Math.abs(scrollTop - targetTop)

  // Only snap if we're within a reasonable distance (30% of viewport)
  if (distance < viewportHeight * 0.3 && distance > 5) {
    // Smooth snap animation
    isScrolling.value = true
    const startTop = scrollTop
    const startTime = performance.now()
    const duration = Math.min(400, 200 + distance * 0.5) // Faster for shorter distances

    const animateSnap = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      container.scrollTop = startTop + (targetTop - startTop) * eased

      if (progress < 1) {
        scrollAnimationId.value = requestAnimationFrame(animateSnap)
      } else {
        container.scrollTop = targetTop
        isScrolling.value = false
        scrollAnimationId.value = null
        currentSection.value = nearestIndex
        history.replaceState(null, '', '#' + sections[nearestIndex].id)
      }
    }

    scrollAnimationId.value = requestAnimationFrame(animateSnap)
  }
}

const handleScroll = () => {
  if (!scrollContainer.value || isScrolling.value) return

  const container = scrollContainer.value
  const scrollTop = container.scrollTop
  const now = performance.now()

  // Calculate velocity
  const timeDelta = now - lastScrollTime.value
  if (timeDelta > 0) {
    scrollVelocity.value = (scrollTop - lastScrollTop.value) / timeDelta
  }

  lastScrollTime.value = now
  lastScrollTop.value = scrollTop

  // Find current section for indicator
  const viewportHeight = container.clientHeight
  let bestSection = 0
  let bestVisibility = 0

  for (let i = 0; i < container.children.length; i++) {
    const section = container.children[i]
    const sectionTop = section.offsetTop - container.offsetTop
    const sectionBottom = sectionTop + section.offsetHeight
    const visibleTop = Math.max(sectionTop, scrollTop)
    const visibleBottom = Math.min(sectionBottom, scrollTop + viewportHeight)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop)
    const coversTop = sectionTop <= scrollTop + 100 && sectionBottom > scrollTop + 100
    const visibility = coversTop ? visibleHeight + 10000 : visibleHeight

    if (visibility > bestVisibility) {
      bestVisibility = visibility
      bestSection = i
    }
  }

  if (bestSection !== currentSection.value) {
    currentSection.value = bestSection
    history.replaceState(null, '', '#' + sections[bestSection].id)
  }

  // Clear previous timeout and set new one for scroll end detection
  if (scrollEndTimeout.value) {
    clearTimeout(scrollEndTimeout.value)
  }

  // Snap after scroll ends (when user stops scrolling)
  scrollEndTimeout.value = setTimeout(() => {
    // Only snap if velocity is low (user has stopped or nearly stopped)
    if (Math.abs(scrollVelocity.value) < 0.5) {
      snapToNearestSection()
    }
  }, 150)
}

/** Sync URL hash with section (deep links, back button). */
const syncHashToSection = () => {
  const hash = location.hash.slice(1)
  if (!hash) return
  const index = sections.findIndex(s => s.id === hash)
  if (index >= 0 && index !== currentSection.value) {
    scrollToSection(index)
  }
}

const handleKeydown = (e) => {
  if (isEnqueteOpen.value) return

  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    e.preventDefault()
    if (currentSection.value < sections.length - 1) {
      scrollToSection(currentSection.value + 1)
    }
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    e.preventDefault()
    if (currentSection.value > 0) {
      scrollToSection(currentSection.value - 1)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('hashchange', syncHashToSection)
  // Initial hash: scroll to section after DOM is ready
  nextTick(() => syncHashToSection())
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('hashchange', syncHashToSection)
  if (scrollEndTimeout.value) {
    clearTimeout(scrollEndTimeout.value)
  }
  if (scrollAnimationId.value) {
    cancelAnimationFrame(scrollAnimationId.value)
  }
})
</script>

<template>
  <div class="app" :class="{ 'enquete-open': isEnqueteOpen }">
    <!-- Minimal sticky header (mobile only, Apple-style) -->
    <header class="mobile-header" :class="{ 'header-hidden': headerHidden }" v-if="!isEnqueteOpen">
      <span class="mobile-header-logo">Enquête IRVE</span>
      <span class="mobile-header-title">{{ sections[currentSection]?.label ?? 'Accueil' }}</span>
      <button
        type="button"
        class="mobile-header-cta"
        @click="openEnquete"
        aria-label="Participer à l'enquête"
      >
        Participer
      </button>
    </header>

    <!-- Side navigation dots -->
    <nav class="section-nav" v-if="!isEnqueteOpen">
      <button
        v-for="(section, index) in sections"
        :key="section.id"
        class="section-dot"
        :class="{ active: currentSection === index }"
        @click="scrollToSection(index)"
        :aria-label="section.label"
      >
        <span class="section-tooltip">{{ section.label }}</span>
      </button>
    </nav>

    <!-- Main scroll container -->
    <div
      class="scroll-container"
      ref="scrollContainer"
      @scroll="handleScroll"
    >
      <section
        v-for="(section, index) in sections"
        :key="section.id"
        :id="section.id"
        class="full-section"
        :class="{ active: currentSection === index }"
      >
        <div class="section-content">
          <component :is="section.component" />
        </div>

        <!-- Scroll indicator -->
        <button
          v-if="index < sections.length - 1"
          class="scroll-indicator"
          @click="scrollToSection(index + 1)"
        >
          <span class="scroll-indicator-text">Défiler</span>
          <span class="scroll-indicator-arrow">&#8595;</span>
        </button>
      </section>
    </div>

    <!-- Enquete modal -->
    <Transition name="modal">
      <div v-if="isEnqueteOpen" class="enquete-modal">
        <div class="enquete-modal-header">
          <h2>Participer à l'enquête</h2>
          <button class="enquete-close" @click="closeEnquete">
            <span>&#10005;</span>
          </button>
        </div>
        <div class="enquete-modal-content">
          <EnqueteView />
        </div>
      </div>
    </Transition>

    <!-- Modal backdrop -->
    <Transition name="fade">
      <div
        v-if="isEnqueteOpen"
        class="modal-backdrop"
        @click="closeEnquete"
      ></div>
    </Transition>
  </div>
</template>

<style>
/* Reset for full-page scroll */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
}

#app {
  height: 100%;
}
</style>

<style scoped>
.app {
  height: 100vh;
  overflow: hidden;
  position: relative;
}

/* Scroll container - no CSS snap, handled by JS */
.scroll-container {
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: calc(56px + env(safe-area-inset-top, 0));
  overscroll-behavior: contain;
}

.full-section {
  min-height: calc(100vh - 56px - env(safe-area-inset-top, 0));
  position: relative;
}

.section-content {
  padding-bottom: 80px;
}

/* Hide default page styling */
.section-content :deep(.page) {
  min-height: auto;
  padding-top: 1rem;
}

.section-content :deep(.hero) {
  padding: 2rem 0;
}

@media (min-width: 768px) {
  .section-content :deep(.hero) {
    padding: 3rem 0;
  }
}

/* Section navigation dots */
.section-nav {
  position: fixed;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-border);
  border: 2px solid var(--color-bg);
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-dot:hover {
  background: var(--color-primary-light);
  transform: scale(1.2);
}

.section-dot.active {
  background: var(--color-primary);
  transform: scale(1.3);
}

.section-tooltip {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--color-text);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
}

.section-dot:hover .section-tooltip {
  opacity: 1;
  right: 28px;
}

/* Scroll indicator */
.scroll-indicator {
  position: absolute;
  bottom: 2rem;
  bottom: calc(2rem + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.3s ease;
  animation: bounce 2s infinite;
}

.scroll-indicator:hover {
  color: var(--color-primary);
}

.scroll-indicator-text {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.scroll-indicator-arrow {
  font-size: 1.5rem;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  40% {
    transform: translateX(-50%) translateY(-10px);
  }
  60% {
    transform: translateX(-50%) translateY(-5px);
  }
}

/* Sticky header */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  padding: 0 1.5rem;
  padding-top: env(safe-area-inset-top, 0);
  min-height: 56px;
  height: calc(56px + env(safe-area-inset-top, 0));
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  z-index: 110;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-header.header-hidden {
  transform: translateY(-100%);
}

.mobile-header-logo {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  flex-shrink: 0;
}

.mobile-header-title {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-muted);
  flex: 1;
  text-align: center;
  padding: 0 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-header-cta {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.2s;
}

.mobile-header-cta:hover {
  background: var(--color-primary-dark);
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .mobile-header {
    padding: 0 1rem;
  }

  .mobile-header-logo {
    font-size: 0.9375rem;
    max-width: 30%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-header-title {
    font-size: 0.9375rem;
    padding: 0 0.5rem;
  }

  .mobile-header-cta {
    padding: 0.5rem 0.75rem;
  }

  .section-nav {
    display: none;
  }

  .scroll-indicator {
    bottom: 5rem;
    bottom: calc(5rem + env(safe-area-inset-bottom, 0));
  }
}

/* Enquete modal */
.enquete-modal {
  position: fixed;
  inset: 0;
  background: var(--color-bg);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.enquete-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.enquete-modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.enquete-close {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-alt);
  border: none;
  border-radius: 50%;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.enquete-close:hover {
  background: var(--color-border);
}

.enquete-modal-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 2rem;
}

.enquete-modal-content :deep(.page) {
  min-height: auto;
  padding-top: 0;
}

.enquete-modal-content :deep(.page-header) {
  display: none;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 190;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from {
  transform: translateY(100%);
}

.modal-leave-to {
  transform: translateY(100%);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hide footer in this mode */
.app :deep(footer) {
  display: none;
}
</style>
