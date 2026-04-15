document.addEventListener("DOMContentLoaded", function () {
  const slidesContainer = document.getElementById("slides");
  const dotsContainer = document.getElementById("slide-dots");
  const prevBtn = document.querySelector(".slide-btn.prev");
  const nextBtn = document.querySelector(".slide-btn.next");

  if (!slidesContainer || !dotsContainer) {
    return;
  }

  let currentSlide = 0;
  let slides = [];
  let dots = [];
  let autoRotate = null;

  function createSlide(src, index) {
    const slide = document.createElement("div");
    slide.className = "slide";
    if (index === 0) {
      slide.classList.add("active");
    }

    const img = document.createElement("img");
    img.src = src;
    img.alt = "Screenshot " + (index + 1);

    slide.appendChild(img);
    slidesContainer.appendChild(slide);

    const dot = document.createElement("button");
    dot.className = "dot";
    dot.type = "button";
    dot.setAttribute("aria-label", "Slide " + (index + 1));

    if (index === 0) {
      dot.classList.add("active");
    }

    dot.addEventListener("click", function () {
      showSlide(index);
      restartAutoRotate();
    });

    dotsContainer.appendChild(dot);
  }

  function showSlide(index) {
    if (!slides.length) {
      return;
    }

    if (index < 0) {
      index = slides.length - 1;
    }

    if (index >= slides.length) {
      index = 0;
    }

    slides.forEach(function (slide) {
      slide.classList.remove("active");
    });

    dots.forEach(function (dot) {
      dot.classList.remove("active");
    });

    slides[index].classList.add("active");
    dots[index].classList.add("active");
    currentSlide = index;
  }

  function restartAutoRotate() {
    if (autoRotate) {
      clearInterval(autoRotate);
    }

    autoRotate = setInterval(function () {
      showSlide(currentSlide + 1);
    }, 5000);
  }

  function bindControls() {
    slides = Array.from(document.querySelectorAll(".slide"));
    dots = Array.from(document.querySelectorAll(".slide-dots .dot"));

    if (!slides.length) {
      return;
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        showSlide(currentSlide - 1);
        restartAutoRotate();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        showSlide(currentSlide + 1);
        restartAutoRotate();
      });
    }

    restartAutoRotate();
  }

  function tryLoadScreenshots(index) {
    const src = "assets/images/screenshot-" + index + ".png";
    const testImage = new Image();

    testImage.onload = function () {
      createSlide(src, index - 1);
      tryLoadScreenshots(index + 1);
    };

    testImage.onerror = function () {
      slides = Array.from(document.querySelectorAll(".slide"));
      dots = Array.from(document.querySelectorAll(".slide-dots .dot"));

      if (!slides.length) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className = "slide-empty";
        emptyMessage.textContent = "No screenshots available yet.";
        slidesContainer.appendChild(emptyMessage);

        if (prevBtn) {
          prevBtn.style.display = "none";
        }

        if (nextBtn) {
          nextBtn.style.display = "none";
        }

        dotsContainer.style.display = "none";
        return;
      }

      bindControls();
      showSlide(0);
    };

    testImage.src = src;
  }

  tryLoadScreenshots(1);
});