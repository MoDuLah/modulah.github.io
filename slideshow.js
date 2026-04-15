document.addEventListener("DOMContentLoaded", function () {
	let currentSlide = 0;

	const slides = document.querySelectorAll(".slide");
	const dots = document.querySelectorAll(".slide-dots .dot");

	if (!slides.length) return;

	function showSlide(index) {
		if (index < 0) index = slides.length - 1;
		if (index >= slides.length) index = 0;

		slides.forEach((slide) => slide.classList.remove("active"));
		dots.forEach((dot) => dot.classList.remove("active"));

		slides[index].classList.add("active");

		if (dots[index]) {
			dots[index].classList.add("active");
		}

		currentSlide = index;
	}

	function changeSlide(step) {
		showSlide(currentSlide + step);
	}

	function goToSlide(index) {
		showSlide(index);
	}

	// Attach button listeners
	const prevBtn = document.querySelector(".slide-btn.prev");
	const nextBtn = document.querySelector(".slide-btn.next");

	if (prevBtn) prevBtn.addEventListener("click", () => changeSlide(-1));
	if (nextBtn) nextBtn.addEventListener("click", () => changeSlide(1));

	// Attach dot listeners
	dots.forEach((dot, index) => {
		dot.addEventListener("click", () => goToSlide(index));
	});

	// Auto-rotate
	setInterval(() => {
		showSlide(currentSlide + 1);
	}, 5000);

	// Initialize
	showSlide(0);
});