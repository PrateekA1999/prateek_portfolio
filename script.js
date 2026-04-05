(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const THEME_STORAGE_KEY = 'resume-theme';
  const AUTO_SCROLL_DELAY = 10000;
  const ACTIVE_SECTION_OFFSET = 40;

  const topNav = $('.top-nav');
  const navToggle = $('#navToggle');
  const navMenu = $('#navMenu');
  const themeButtons = $$('.theme-switch');
  const navLinks = $$('.nav-link');
  const observedBlocks = $$('[data-obs]');
  const carousels = $$('[data-carousel-name]');
  const body = document.body;
  const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initRevealAnimations() {
  if (!observedBlocks.length) return;

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const bars = $$('.bar-fill', entry.target);

      if (entry.isIntersecting) {
        entry.target.classList.add('visible');

        bars.forEach((bar, index) => {
          const width = Number(bar.dataset.w || 0);

          window.setTimeout(() => {
            bar.style.transform = `scaleX(${width})`;
          }, 120 * index);
        });
      } else {
        entry.target.classList.remove('visible');

        bars.forEach((bar) => {
          bar.style.transform = 'scaleX(0)';
        });
      }
    });
  }, { threshold: 0.2 });

  observedBlocks.forEach((element) => {
    $$('.bar-fill', element).forEach((bar) => {
      bar.style.transform = 'scaleX(0)';
      bar.style.transformOrigin = 'left center';
    });

    revealObserver.observe(element);
  });
}

  function setMenuOpen(isOpen) {
    if (!topNav || !navToggle || !navMenu) return;
    topNav.classList.toggle('menu-open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  }

  function initMenuToggle() {
    if (!topNav || !navToggle || !navMenu) return;

    setMenuOpen(false);

    navToggle.addEventListener('click', () => {
      const isCurrentlyOpen = navToggle.getAttribute('aria-expanded') === 'true';
      setMenuOpen(!isCurrentlyOpen);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    });
  }

  function applyTheme(theme) {
    const effectiveTheme =
      theme === 'system'
        ? (systemThemeMedia.matches ? 'dark' : 'light')
        : theme;

    body.dataset.theme = effectiveTheme;
    body.dataset.themeMode = theme;
    body.classList.remove('theme-system-light', 'theme-system-dark');

    if (theme === 'system') {
      body.classList.add(
        effectiveTheme === 'dark' ? 'theme-system-dark' : 'theme-system-light'
      );
    }

    themeButtons.forEach((button) => {
      const isActive = button.dataset.themeValue === theme;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function initThemeSwitcher() {
    if (!themeButtons.length) return;

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    applyTheme(savedTheme);

    themeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const nextTheme = button.dataset.themeValue || 'system';
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
      });
    });

    systemThemeMedia.addEventListener?.('change', () => {
      const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }

  function getScrollTarget(trigger) {
    if (!trigger) return null;

    const selector =
      trigger.getAttribute('data-scroll-target') ||
      trigger.getAttribute('href');

    if (!selector || !selector.startsWith('#')) return null;
    return document.querySelector(selector);
  }

  function scrollToTarget(target) {
    if (!target) return;

    const navHeight = topNav ? topNav.offsetHeight : 72;
    const targetTop =
      target.getBoundingClientRect().top + window.scrollY - navHeight - 12;

    window.scrollTo({
      top: targetTop,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }

  function getTrackableSections() {
    return $$('section[id], main [id]')
      .filter((section) => section.id && section.id !== 'main');
  }

  function updateActiveSection() {
    const sections = getTrackableSections();
    if (!sections.length || !navLinks.length) return;

    const navHeight = topNav ? topNav.offsetHeight : 72;
    const probeY = window.scrollY + navHeight + ACTIVE_SECTION_OFFSET;

    let currentSectionId = sections[0].id;

    sections.forEach((section) => {
      if (probeY >= section.offsetTop) {
        currentSectionId = section.id;
      }
    });

    const isNearPageBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 8;

    if (isNearPageBottom) {
      currentSectionId = sections[sections.length - 1].id;
    }

    navLinks.forEach((link) => {
      const isActive = link.getAttribute('href') === `#${currentSectionId}`;
      link.classList.toggle('active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function initInPageNavigation() {
    const scrollTriggers = $$('a[href^="#"], button[data-scroll-target]');

    scrollTriggers.forEach((trigger) => {
      const target = getScrollTarget(trigger);
      if (!target) return;

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        scrollToTarget(target);
        window.setTimeout(updateActiveSection, 180);
      });
    });

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    window.addEventListener('load', updateActiveSection);

    updateActiveSection();
  }

  function initCarousel(carousel) {
    const viewport = $('.carousel-viewport', carousel);
    const track = $('.carousel-track', carousel);
    const slides = $$('.carousel-slide', carousel);
    const previousButton = $('.carousel-btn.prev', carousel);
    const nextButton = $('.carousel-btn.next', carousel);
    const dots = $$('.carousel-dot', carousel);

    if (!viewport || !track || !slides.length || !previousButton || !nextButton) {
      return;
    }

    let activeIndex = 0;
    let autoAdvanceTimer = null;
    let idleSnapTimer = null;
    let animationFrameId = null;
    let isDragging = false;
    let hasDragged = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activeMouseButton = 0;
    let suppressClick = false;

    const clampIndex = (value) =>
      Math.max(0, Math.min(value, slides.length - 1));

    const getPeekWidth = () =>
      Number.parseFloat(getComputedStyle(carousel).getPropertyValue('--peek')) || 0;

    const getMaxScrollLeft = () =>
      Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    const getTargetScrollLeft = (index) => {
      const slide = slides[clampIndex(index)];
      if (!slide) return 0;

      return Math.max(
        0,
        Math.min(slide.offsetLeft - getPeekWidth(), getMaxScrollLeft())
      );
    };

    const getNearestIndex = () => {
      let nearestSlideIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      slides.forEach((slide, index) => {
        const distance = Math.abs(
          viewport.scrollLeft - getTargetScrollLeft(index)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestSlideIndex = index;
        }
      });

      return nearestSlideIndex;
    };

    const updateMeasurements = () => {
      const peek = getPeekWidth();
      const gap =
        Number.parseFloat(getComputedStyle(track).columnGap) ||
        Number.parseFloat(getComputedStyle(track).gap) ||
        0;
      const viewportWidth = Math.min(
        viewport.clientWidth,
        window.visualViewport?.width || window.innerWidth,
      );
      const slideWidth = Math.max(220, viewportWidth - peek * 2);

      carousel.style.setProperty('--slide-width', `${slideWidth}px`);
      carousel.dataset.slideWidth = String(slideWidth);
      carousel.dataset.slideGap = String(gap);
    };

    const updateCarouselUI = (index, shouldFocusSlide = false) => {
      activeIndex = clampIndex(index);

      previousButton.disabled = activeIndex === 0;
      nextButton.disabled = activeIndex === slides.length - 1;

      slides.forEach((slide, indexValue) => {
        const isActive = indexValue === activeIndex;
        slide.setAttribute('aria-hidden', String(!isActive));
        slide.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      dots.forEach((dot, indexValue) => {
        const isActive = indexValue === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', String(isActive));
        dot.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      if (shouldFocusSlide) {
        slides[activeIndex]?.focus({ preventScroll: true });
      }
    };

    const stopAutoAdvance = () => {
      window.clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    };

    const clearIdleSnap = () => {
      window.clearTimeout(idleSnapTimer);
      idleSnapTimer = null;
    };

    const animateScroll = (targetScrollLeft, onComplete, duration = 520) => {
      window.cancelAnimationFrame(animationFrameId);

      const initialScrollLeft = viewport.scrollLeft;
      const distance = targetScrollLeft - initialScrollLeft;

      if (Math.abs(distance) < 1 || prefersReducedMotion) {
        viewport.scrollLeft = targetScrollLeft;
        onComplete?.();
        return;
      }

      const easeOutQuart = (progress) => 1 - Math.pow(1 - progress, 4);
      const startTime = performance.now();

      const step = (currentTime) => {
        const progress = Math.min(1, (currentTime - startTime) / duration);
        viewport.scrollLeft =
          initialScrollLeft + distance * easeOutQuart(progress);

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(step);
        } else {
          viewport.scrollLeft = targetScrollLeft;
          onComplete?.();
        }
      };

      animationFrameId = window.requestAnimationFrame(step);
    };

    const startAutoAdvance = () => {
      if (prefersReducedMotion || slides.length < 2 || document.hidden) {
        return;
      }

      stopAutoAdvance();

      autoAdvanceTimer = window.setTimeout(() => {
        const nextIndex =
          activeIndex === slides.length - 1 ? 0 : activeIndex + 1;
        goToSlide(nextIndex, false);
      }, AUTO_SCROLL_DELAY);
    };

    const snapToNearestSlide = (shouldFocusSlide = false) => {
      const nearestIndex = getNearestIndex();
      animateScroll(getTargetScrollLeft(nearestIndex), () => {
        updateCarouselUI(nearestIndex, shouldFocusSlide);
      });
    };

    const scheduleSnapToNearestSlide = () => {
      clearIdleSnap();
      idleSnapTimer = window.setTimeout(() => {
        if (!isDragging) {
          snapToNearestSlide(false);
        }
      }, 140);
    };

    const goToSlide = (index, shouldFocusSlide = true) => {
      stopAutoAdvance();
      clearIdleSnap();

      const nextIndex = clampIndex(index);
      animateScroll(getTargetScrollLeft(nextIndex), () => {
        updateCarouselUI(nextIndex, shouldFocusSlide);
        startAutoAdvance();
      });
    };

    const beginDrag = (clientX, mouseButton = 0) => {
      stopAutoAdvance();
      clearIdleSnap();
      window.cancelAnimationFrame(animationFrameId);

      isDragging = true;
      hasDragged = false;
      activeMouseButton = mouseButton;
      startX = clientX;
      startScrollLeft = viewport.scrollLeft;

      viewport.classList.add('is-dragging');
    };

    const moveDrag = (clientX) => {
      if (!isDragging) return;

      const deltaX = clientX - startX;

      if (Math.abs(deltaX) > 4) {
        hasDragged = true;
        suppressClick = true;
      }

      viewport.scrollLeft = Math.max(
        0,
        Math.min(getMaxScrollLeft(), startScrollLeft - deltaX)
      );

      updateCarouselUI(getNearestIndex());
    };

    const endDrag = () => {
      if (!isDragging) return;

      isDragging = false;
      viewport.classList.remove('is-dragging');
      snapToNearestSlide(false);
      startAutoAdvance();

      window.setTimeout(() => {
        suppressClick = false;
      }, 80);
    };

    previousButton.addEventListener('click', () => goToSlide(activeIndex - 1));
    nextButton.addEventListener('click', () => goToSlide(activeIndex + 1));

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => goToSlide(index));
    });

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToSlide(activeIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToSlide(activeIndex + 1);
      }

      if (event.key === 'Home') {
        event.preventDefault();
        goToSlide(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        goToSlide(slides.length - 1);
      }
    });

    viewport.addEventListener('scroll', () => {
      if (isDragging) return;
      updateCarouselUI(getNearestIndex());
      scheduleSnapToNearestSlide();
    }, { passive: true });

    viewport.addEventListener('wheel', (event) => {
      const dominantHorizontalWheel =
        Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (!dominantHorizontalWheel && Math.abs(event.deltaY) < 1) {
        return;
      }

      event.preventDefault();
      stopAutoAdvance();
      clearIdleSnap();

      viewport.scrollLeft += dominantHorizontalWheel
        ? event.deltaX
        : event.deltaY;

      updateCarouselUI(getNearestIndex());
      scheduleSnapToNearestSlide();
      startAutoAdvance();
    }, { passive: false });

    viewport.addEventListener('mousedown', (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      if (event.button === 2) event.preventDefault();

      beginDrag(event.clientX, event.button);
    });

    window.addEventListener('mousemove', (event) => {
      if (!isDragging) return;

      if (activeMouseButton === 2 && !(event.buttons & 2)) {
        endDrag();
        return;
      }

      if (activeMouseButton === 0 && !(event.buttons & 1)) {
        endDrag();
        return;
      }

      moveDrag(event.clientX);
    });

    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mouseleave', endDrag);

    viewport.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      beginDrag(touch.clientX);
    }, { passive: true });

    viewport.addEventListener('touchmove', (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      moveDrag(touch.clientX);
    }, { passive: true });

    viewport.addEventListener('touchend', endDrag, { passive: true });
    viewport.addEventListener('touchcancel', endDrag, { passive: true });

    viewport.addEventListener('contextmenu', (event) => {
      if (isDragging || hasDragged) {
        event.preventDefault();
      }
    });

    viewport.addEventListener('click', (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    carousel.addEventListener('mouseenter', stopAutoAdvance);
    carousel.addEventListener('mouseleave', startAutoAdvance);
    carousel.addEventListener('focusin', stopAutoAdvance);
    carousel.addEventListener('focusout', (event) => {
      if (carousel.contains(event.relatedTarget)) return;
      startAutoAdvance();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoAdvance();
      } else {
        startAutoAdvance();
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurements();
      updateCarouselUI(activeIndex, false);
    });

    resizeObserver.observe(viewport);

    updateMeasurements();
    updateCarouselUI(0, false);
    startAutoAdvance();
  }

  function initCarousels() {
    carousels.forEach(initCarousel);
  }

  initRevealAnimations();
  initMenuToggle();
  initThemeSwitcher();
  initInPageNavigation();
  initCarousels();
})();

/* Hero stat count-up animation */
(() => {
  const statNumbers = [...document.querySelectorAll('.hero-stats .stat-num')];
  if (!statNumbers.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const parseCountTarget = (text) => {
    const cleaned = text.trim();
    const numberMatch = cleaned.match(/\d+(?:\.\d+)?/);
    if (!numberMatch) return null;

    const numericValue = Number(numberMatch[0]);
    const prefix = cleaned.slice(0, numberMatch.index);
    const suffix = cleaned.slice((numberMatch.index || 0) + numberMatch[0].length);

    return { value: numericValue, prefix, suffix };
  };

  const formatValue = (value, originalNumberText) => {
    const hasDecimal = originalNumberText.includes('.');
    if (hasDecimal) return value.toFixed(originalNumberText.split('.')[1].length);
    return Math.round(value).toString();
  };

  const animateCounter = (element) => {
    if (element.dataset.countAnimated === 'true') return;

    const originalText = element.textContent || '';
    const parsed = parseCountTarget(originalText);
    if (!parsed) return;

    element.dataset.countAnimated = 'true';

    if (prefersReducedMotion) {
      element.textContent = originalText;
      return;
    }

    const numberTextMatch = originalText.match(/\d+(?:\.\d+)?/);
    const originalNumberText = numberTextMatch ? numberTextMatch[0] : String(parsed.value);

    const duration = 1200;
    const startTime = performance.now();
    const startValue = 0;
    const endValue = parsed.value;

    const step = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * eased;

      element.textContent = `${parsed.prefix}${formatValue(currentValue, originalNumberText)}${parsed.suffix}`;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = originalText;
      }
    };

    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver((entries, statsObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      statsObserver.unobserve(entry.target);
    });
  }, { threshold: 0.55 });

  statNumbers.forEach((item) => {
    if (/\d/.test(item.textContent || '')) {
      observer.observe(item);
    }
  });
})();

(() => {
  const section = document.querySelector(".projects-showcase");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          section.classList.add("show"); // fade IN
        } else {
          section.classList.remove("show"); // fade OUT
        }
      });
    },
    {
      threshold: 0.1, // trigger when 10% visible
    },
  );

  observer.observe(section);
})();