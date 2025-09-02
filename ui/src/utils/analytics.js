export function trackPageView(url) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }
}

export function initScrollDepthTracking() {
  if (typeof window === "undefined" || !window.gtag) {
    console.warn("gtag not available, scroll tracking disabled");
    return;
  }

  let scrollTracked25 = false;
  let scrollTracked50 = false;
  let scrollTracked75 = false;
  let scrollTracked100 = false;

  function trackScrollDepth() {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollPercent = ((scrollTop + windowHeight) / docHeight) * 100;

    if (scrollPercent > 25 && !scrollTracked25) {
      window.gtag("event", "scroll_depth", { depth: "25%" });
      scrollTracked25 = true;
      console.log("Scroll tracked: 25%");
    }
    if (scrollPercent > 50 && !scrollTracked50) {
      window.gtag("event", "scroll_depth", { depth: "50%" });
      scrollTracked50 = true;
      console.log("Scroll tracked: 50%");
    }
    if (scrollPercent > 75 && !scrollTracked75) {
      window.gtag("event", "scroll_depth", { depth: "75%" });
      scrollTracked75 = true;
      console.log("Scroll tracked: 75%");
    }
    if (scrollPercent > 95 && !scrollTracked100) {
      window.gtag("event", "scroll_depth", { depth: "100%" });
      scrollTracked100 = true;
      console.log("Scroll tracked: 100%");
    }
  }

  // Add scroll event listener
  window.addEventListener("scroll", trackScrollDepth);

  // Return cleanup function
  return () => {
    window.removeEventListener("scroll", trackScrollDepth);
  };
}

export function trackCustomEvent(eventName, parameters = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, parameters);
    console.log(`Custom event tracked: ${eventName}`, parameters);
  }
}
